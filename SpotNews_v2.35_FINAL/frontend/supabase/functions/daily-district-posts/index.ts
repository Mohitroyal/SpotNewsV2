// Supabase Edge Function: daily-district-posts
// Runs every day at 05:30 IST (pg_cron, see migration 20261103_daily_district_posts.sql).
// For all 59 districts of Andhra Pradesh + Telangana:
//   1. gets today's + tomorrow's forecast from Open-Meteo (free, no API key)
//   2. builds 6 posts (good morning, weather, farming, diet, health, good night)
//   3. saves them in public.daily_posts — the app shows each post from its publish time
//
// Deploy:  supabase functions deploy daily-district-posts --no-verify-jwt
//          supabase secrets set CRON_SECRET=<any long random text>
// Manual run (e.g. to test today):  POST /functions/v1/daily-district-posts  {"date":"2026-11-03"}

import { createClient } from "jsr:@supabase/supabase-js@2";
import { DISTRICTS, buildDailyPosts, istDate, type DayWeather, type DistrictInfo } from "../_shared/dailyContentEngine.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const DAILY_VARS = [
  "weather_code", "temperature_2m_max", "temperature_2m_min", "apparent_temperature_max",
  "precipitation_sum", "precipitation_probability_max", "uv_index_max", "wind_gusts_10m_max",
  "relative_humidity_2m_mean",
].join(",");

type OmDaily = Record<string, (number | null)[]> & { time: string[] };

function toDay(d: OmDaily, i: number): DayWeather | null {
  const tMax = d.temperature_2m_max?.[i];
  const tMin = d.temperature_2m_min?.[i];
  if (tMax == null || tMin == null) return null;
  return {
    tMax, tMin,
    feelsMax: d.apparent_temperature_max?.[i] ?? null,
    rainMm: d.precipitation_sum?.[i] ?? null,
    rainProb: d.precipitation_probability_max?.[i] ?? null,
    humidity: d.relative_humidity_2m_mean?.[i] ?? null,
    uvMax: d.uv_index_max?.[i] ?? null,
    gustMax: d.wind_gusts_10m_max?.[i] ?? null,
    code: d.weather_code?.[i] ?? null,
  };
}

/** Open-Meteo accepts many coordinates in one call → 59 districts in 3 requests. */
async function forecast(batch: DistrictInfo[]): Promise<OmDaily[]> {
  let vars = DAILY_VARS;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${batch.map((d) => d.lat).join(",")}` +
      `&longitude=${batch.map((d) => d.lng).join(",")}&daily=${vars}&timezone=Asia%2FKolkata&forecast_days=2`;
    const res = await fetch(url);
    if (res.status === 400) {
      // A variable was rejected → retry with the basic set only
      vars = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max";
      continue;
    }
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json) ? json : [json];
      return list.map((x: { daily: OmDaily }) => x.daily);
    }
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
  throw new Error("Open-Meteo forecast failed");
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const date: string = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? body.date : istDate();
  const only: string | undefined = body.district;
  const districts = only ? DISTRICTS.filter((d) => d.en === only) : DISTRICTS;

  const results: { district: string; ok: boolean; error?: string }[] = [];
  for (let i = 0; i < districts.length; i += 20) {
    const batch = districts.slice(i, i + 20);
    let dailies: OmDaily[] = [];
    try {
      dailies = await forecast(batch);
    } catch (e) {
      batch.forEach((d) => results.push({ district: d.en, ok: false, error: String(e) }));
      continue;
    }
    const rows = batch.flatMap((d, k) => {
      const daily = dailies[k];
      const idx = daily?.time?.indexOf(date) ?? -1;
      const today = idx >= 0 ? toDay(daily, idx) : null;
      if (!today) {
        results.push({ district: d.en, ok: false, error: "no forecast for date" });
        return [];
      }
      const tomorrow = toDay(daily, idx + 1);
      results.push({ district: d.en, ok: true });
      return buildDailyPosts(d, date, today, tomorrow);
    });
    if (rows.length) {
      const { error } = await db.from("daily_posts").upsert(rows, { onConflict: "district,post_date,kind" });
      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { "content-type": "application/json" } });
      }
    }
  }

  // Keep the table small: remove posts older than 15 days
  await db.from("daily_posts").delete().lt("post_date", istDate(new Date(Date.now() - 15 * 86400000)));

  const failed = results.filter((r) => !r.ok);
  return new Response(JSON.stringify({ ok: failed.length === 0, date, districts: results.length, failed }), {
    headers: { "content-type": "application/json" },
  });
});
