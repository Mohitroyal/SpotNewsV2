-- RTI Express Spot News 24x7 — automatic daily posts for every district (Nov 2026)
-- Good morning · weather · farming · diet · health · good night
-- Apply in Supabase → SQL editor. Needs the pg_cron and pg_net extensions
-- (Database → Extensions → enable "pg_cron" and "pg_net").

create table if not exists public.daily_posts (
  id          bigserial primary key,
  district    text not null,          -- English name, same as the app's location picker
  state       text not null,
  post_date   date not null,          -- India date
  kind        text not null check (kind in ('morning','weather','agri','diet','health','night')),
  publish_at  timestamptz not null,   -- the app shows the post from this time
  emoji       text,
  theme       text,
  title_te    text not null,
  subtitle_en text,
  body_te     text,
  bullets     jsonb not null default '[]'::jsonb,
  footer_te   text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (district, post_date, kind)
);

create index if not exists daily_posts_lookup on public.daily_posts (district, post_date, publish_at);

alter table public.daily_posts enable row level security;

-- Readers see a post only after its publish time; only the Edge Function (service role) writes.
drop policy if exists "daily_posts public read" on public.daily_posts;
create policy "daily_posts public read" on public.daily_posts
  for select using (publish_at <= now());

-- Run every day at 05:30 IST (= 00:00 UTC).
-- Replace <PROJECT_REF> and <CRON_SECRET> before running this part.
select cron.unschedule('daily-district-posts') where exists (select 1 from cron.job where jobname = 'daily-district-posts');
select cron.schedule(
  'daily-district-posts', '0 0 * * *',
  $$ select net.http_post(
       url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-district-posts',
       headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
       body    := '{}'::jsonb,
       timeout_milliseconds := 60000) $$
);
