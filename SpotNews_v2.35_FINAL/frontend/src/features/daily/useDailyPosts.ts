// Loads the automatic posts for the reader's district.
// Source 1: public.daily_posts (filled every morning by the daily-district-posts Edge Function)
// Source 2: if that is empty (cron not set up yet / offline), the same posts are built on the phone
//           from the live weather, so readers always see them.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { WeatherData } from '@/services/weatherService';
import {
  buildDailyPosts, findDistrict, istDate, kindsFor, orderForFeed, DISTRICTS,
  type DailyPost, type DayWeather, type PostKind,
} from './dailyContentEngine';

import { buildMoments } from '@/features/moments/momentsEngine';
import { moodOf, setLiveMood, type Mood } from '@/features/moments/sky';

const COLS = 'district, state, post_date, kind, publish_at, emoji, theme, title_te, subtitle_en, body_te, bullets, footer_te, meta';

function resolveDistrict(district?: string, state?: string) {
  const found = findDistrict(district);
  if (found) return found;
  const capital = (state || '').toLowerCase().includes('andhra') ? 'NTR' : 'Hyderabad';
  return DISTRICTS.find((d) => d.en === capital)!;
}

/** Rough day forecast from the current reading (used only for the offline fallback). */
function approxDay(w: WeatherData | null): DayWeather {
  if (!w) return { tMax: 32, tMin: 23, humidity: 65, code: 2 };
  const hour = new Date(Date.now() + 5.5 * 3600 * 1000).getUTCHours();
  const t = w.temperature;
  const tMax = hour >= 12 && hour <= 16 ? t : t + (hour < 12 ? 5 : 3);
  return { tMax, tMin: t - 7, feelsMax: Math.max(w.apparentTemperature, tMax), humidity: w.humidity, code: w.weatherCode, gustMax: w.windSpeed * 1.5 };
}

const daysAgo = (n: number) => istDate(new Date(Date.now() - n * 86400000));

function liveMood(w: WeatherData | null): Mood {
  const m = moodOf(w?.weatherCode, w?.temperature);
  setLiveMood(m);
  return m;
}

/** Newest first, but the morning greeting and the weather card stay near the top until noon. */
function newestFirst(posts: DailyPost[], now: Date): DailyPost[] {
  const live = orderForFeed(posts, now).sort((a, b) => (a.publish_at < b.publish_at ? 1 : -1));
  const istHour = new Date(now.getTime() + 5.5 * 3600 * 1000).getUTCHours();
  if (istHour >= 12) return live;
  const pinned = live.filter((p) => p.kind === 'weather' || p.kind === 'morning');
  const rest = live.filter((p) => p.kind !== 'weather' && p.kind !== 'morning');
  return [...rest.slice(0, 1), ...pinned, ...rest.slice(1)];
}

/** Today's posts in feed order. Before 6 AM (nothing published yet) it shows yesterday's. */
export function useDailyPosts(district: string, state: string, liveWeather: WeatherData | null) {
  const info = useMemo(() => resolveDistrict(district, state), [district, state]);
  const [serverPosts, setServerPosts] = useState<DailyPost[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 10 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const slow = setTimeout(() => { if (!cancelled) setServerPosts((r) => r ?? []); }, 6000);
    supabase
      .from('daily_posts').select(COLS)
      .eq('district', info.en)
      .in('post_date', [istDate(), daysAgo(1)])
      .order('publish_at', { ascending: true })
      .then(({ data, error }) => {
        if (!cancelled) setServerPosts(!error && data ? (data as DailyPost[]) : []);
      }, () => !cancelled && setServerPosts([]));
    return () => { cancelled = true; clearTimeout(slow); };
  }, [info.en, tick]);

  return useMemo(() => {
    const now = new Date();
    if (serverPosts === null) return [];
    const today = istDate(now);
    const fromServer = (date: string) => serverPosts.filter((p) => p.post_date === date);
    const local = (date: string) =>
      buildDailyPosts(info, date, approxDay(liveWeather), null).map((p) => ({ ...p, meta: { ...p.meta, local: true } }));

    // Server posts win; kinds the server does not have yet (new segments) come from the phone
    const merged = (date: string) => {
      const srv = fromServer(date);
      const have = new Set(srv.map((p) => p.kind));
      return [...srv, ...local(date).filter((p) => !have.has(p.kind))];
    };
    const todays = merged(today);
    // Hourly posts (sunrise → night) for this district, coloured by today's weather
    const mood = liveMood(liveWeather);
    const moments = buildMoments({ district: info, date: today, mood, tempC: liveWeather?.temperature });
    const live = newestFirst([...todays, ...moments], now);
    if (live.length > 3) return live;
    // Early morning: keep today's greeting (if any) and show yesterday's posts after it
    const yest = merged(daysAgo(1));
    const yMoments = buildMoments({ district: info, date: daysAgo(1), mood, tempC: liveWeather?.temperature });
    const yesterdayAll = newestFirst([...yest, ...yMoments], new Date(now.getTime() + 2 * 86400000)).filter((p) => p.kind !== 'morning');
    return [...live, ...yesterdayAll];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPosts, info, liveWeather?.temperature, liveWeather?.weatherCode, tick]);
}

/** One category (weather / farming / health / fitness / diet / environment) for the last 7 days. */
export function useCategoryPosts(kind: PostKind | null, district: string, state: string, liveWeather: WeatherData | null) {
  const info = useMemo(() => resolveDistrict(district, state), [district, state]);
  const [rows, setRows] = useState<DailyPost[] | null>(null);

  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    setRows(null);
    // Slow village network: show the phone-made posts after 6 s, server posts replace them when they arrive
    const slow = setTimeout(() => { if (!cancelled) setRows((r) => r ?? []); }, 6000);
    supabase
      .from('daily_posts').select(COLS)
      .eq('district', info.en).in('kind', kindsFor(kind))
      .gte('post_date', daysAgo(6))
      .order('post_date', { ascending: false })
      .then(({ data, error }) => { if (!cancelled) setRows(!error && data ? (data as DailyPost[]) : []); },
        () => !cancelled && setRows([]));
    return () => { cancelled = true; clearTimeout(slow); };
  }, [kind, info.en]);

  return useMemo(() => {
    if (!kind || rows === null) return [];
    const now = Date.now();
    const live = rows.filter((p) => new Date(p.publish_at).getTime() <= now);
    const kinds = kindsFor(kind);
    const mood = liveMood(liveWeather);
    // "This hour" chip: every hourly post of today and yesterday
    if (kind === 'quote') {
      return [0, 1].flatMap((d) => buildMoments({ district: info, date: daysAgo(d), mood }))
        .filter((p) => new Date(p.publish_at).getTime() <= now)
        .sort((a, b) => (a.publish_at < b.publish_at ? 1 : -1)).slice(0, 30);
    }
    // Fill the week locally for any day / kind the server does not have
    const out: DailyPost[] = [...live];
    for (let d = 0; d < 7; d++) {
      const date = daysAgo(d);
      for (const p of buildDailyPosts(info, date, approxDay(liveWeather), null)) {
        if (!kinds.includes(p.kind) || new Date(p.publish_at).getTime() > now) continue;
        if (out.some((x) => x.post_date === date && x.kind === p.kind)) continue;
        out.push({ ...p, meta: { ...p.meta, local: true } });
      }
      // Hourly posts of the same kind (today and yesterday)
      if (d < 2) out.push(...buildMoments({ district: info, date, mood }).filter((p) => kinds.includes(p.kind) && new Date(p.publish_at).getTime() <= now));
    }
    return out.sort((a, b) => (a.publish_at < b.publish_at ? 1 : -1)).slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, rows, info, liveWeather?.temperature]);
}
