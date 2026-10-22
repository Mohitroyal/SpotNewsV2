// Supabase Edge Function: send-push
// Sends Firebase Cloud Messaging (HTTP v1) notifications.
//   • {"drain": true}  → sends every unsent row in public.push_queue (called every minute by pg_cron)
//   • {"topic": "district_12", "title": "...", "body": "...", "url": "/n/2481"}   → send one now (admin)
//
// Secrets:
//   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat firebase-service-account.json)" CRON_SECRET=...
// (Firebase console → Project settings → Service accounts → Generate new private key)

import { createClient } from "jsr:@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "npm:jose@5";

const SA = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

let cached: { token: string; exp: number } | null = null;
async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const key = await importPKCS8(SA.private_key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(SA.client_email).setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt().setExpirationTime("1h").sign(key);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("OAuth: " + JSON.stringify(j));
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

type Msg = { topic?: string; token?: string; title: string; body?: string; image?: string; url?: string; channel?: string };

async function send(m: Msg) {
  const message: Record<string, unknown> = {
    ...(m.topic ? { topic: m.topic } : { token: m.token }),
    notification: { title: m.title, body: m.body ?? "", ...(m.image ? { image: m.image } : {}) },
    data: { url: m.url ?? "/" },                       // the app opens this route when tapped
    android: {
      priority: "HIGH",
      notification: { channel_id: m.channel ?? "news", icon: "ic_stat_rti", color: "#D61F3A", sound: "default" },
    },
  };
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${SA.project_id}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!r.ok) {
    const err = await r.text();
    // token no longer valid → remove it
    if (m.token && (r.status === 404 || err.includes("UNREGISTERED"))) await db.from("device_tokens").delete().eq("token", m.token);
    throw new Error(`FCM ${r.status}: ${err}`);
  }
}

async function drain() {
  const { data: rows } = await db.from("push_queue").select("*").is("sent_at", null).order("id").limit(100);
  let ok = 0, failed = 0;
  for (const q of rows ?? []) {
    try {
      const channel = q.kind === "weather" ? "weather" : q.kind === "reporter" ? "reporter" : "news";
      const url = q.url ?? (q.kind === "weather" ? "/weather" : "/");
      if (q.user_id) {
        // personal push → every device of that user
        const { data: toks } = await db.from("device_tokens").select("token").eq("user_id", q.user_id);
        for (const t of toks ?? []) await send({ token: t.token, title: q.title, body: q.body, image: q.image_url, url, channel }).catch(() => {});
      } else {
        const topic = q.topic ?? (q.district_id ? `district_${q.district_id}` : "all");
        await send({ topic, title: q.title, body: q.body, image: q.image_url, url, channel });
      }
      await db.from("push_queue").update({ sent_at: new Date().toISOString() }).eq("id", q.id);
      ok++;
    } catch (e) {
      await db.from("push_queue").update({ error: String(e).slice(0, 500), sent_at: new Date().toISOString() }).eq("id", q.id);
      failed++;
    }
  }
  return { ok, failed };
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return new Response("forbidden", { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const result = body.drain ? await drain() : (await send(body as Msg), { ok: 1 });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
