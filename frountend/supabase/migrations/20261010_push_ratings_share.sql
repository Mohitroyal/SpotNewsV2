-- RTI Express Spot News 24x7 — push notifications, reporter star ratings, share links
-- ⚠ ADAPT: this file assumes your existing tables are
--     public.posts     (id bigint, reporter_id uuid, headline text, clipping_url text, image_url text,
--                       district_id int, place text, status text, created_at timestamptz, views int)
--     public.profiles  (id uuid = auth.users.id, full_name text, photo_url text, role text,
--                       verified boolean, experience_years int, district_id int, slug text)
--   Rename the table / column names below if yours differ (search for "posts" and "profiles").

-------------------------------------------------------------------------------
-- 1) PUSH NOTIFICATIONS
-------------------------------------------------------------------------------
create table if not exists public.device_tokens (
  token        text primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  district_id  int,
  platform     text default 'android',
  lang         text default 'te',
  updated_at   timestamptz default now()
);
alter table public.device_tokens enable row level security;
create policy "own tokens" on public.device_tokens for all
  using (user_id = auth.uid() or user_id is null) with check (user_id = auth.uid() or user_id is null);

-- one queue for every kind of push (weather, breaking news, reporter alerts)
create table if not exists public.push_queue (
  id          bigserial primary key,
  created_at  timestamptz default now(),
  sent_at     timestamptz,
  error       text
);
alter table public.push_queue
  add column if not exists kind        text default 'news',          -- news | weather | reporter
  add column if not exists topic       text,                          -- e.g. district_12, all  (broadcast)
  add column if not exists user_id     uuid,                          -- personal push (reporter)
  add column if not exists district_id int,
  add column if not exists level       text,
  add column if not exists title       text,
  add column if not exists body        text,
  add column if not exists image_url   text,
  add column if not exists url         text;                          -- deep link opened on tap, e.g. /n/2481

-- breaking / top news → push to the district topic (max 6 news pushes per district per day)
create or replace function public.enqueue_news_push() returns trigger language plpgsql security definer as $$
begin
  if new.status = 'published' and coalesce(new.is_breaking, false)
     and (select count(*) from public.push_queue
          where kind = 'news' and district_id = new.district_id and created_at > now() - interval '1 day') < 6 then
    insert into public.push_queue (kind, topic, district_id, title, body, image_url, url)
    values ('news', 'district_' || new.district_id, new.district_id,
            'బ్రేకింగ్ · ' || coalesce(new.place, ''), new.headline, coalesce(new.image_url, new.clipping_url), '/n/' || new.id);
  end if;
  return new;
end $$;
alter table public.posts add column if not exists is_breaking boolean default false;
drop trigger if exists trg_news_push on public.posts;
create trigger trg_news_push after insert or update of status on public.posts
  for each row execute function public.enqueue_news_push();

-------------------------------------------------------------------------------
-- 2) REPORTER STAR RATINGS (1–5 stars, one rating per reader per story)
-------------------------------------------------------------------------------
create table if not exists public.story_ratings (
  post_id     bigint references public.posts(id) on delete cascade,
  reporter_id uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  created_at  timestamptz default now(),
  primary key (post_id, user_id)
);
alter table public.story_ratings enable row level security;
create policy "read ratings" on public.story_ratings for select using (true);
-- writes only through rate_story() below

-- readers call:  supabase.rpc('rate_story', { p_post_id: 2481, p_stars: 5 })
create or replace function public.rate_story(p_post_id bigint, p_stars int)
returns void language plpgsql security definer as $$
declare v_reporter uuid; v_title text;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  if p_stars not between 1 and 5 then raise exception 'stars must be 1–5'; end if;
  select reporter_id, headline into v_reporter, v_title from public.posts where id = p_post_id and status = 'published';
  if v_reporter is null then raise exception 'story not found'; end if;
  if v_reporter = auth.uid() then raise exception 'you cannot rate your own story'; end if;
  insert into public.story_ratings (post_id, reporter_id, user_id, stars)
  values (p_post_id, v_reporter, auth.uid(), p_stars)
  on conflict (post_id, user_id) do update set stars = excluded.stars, created_at = now();
  -- tell the reporter about 5-star ratings (personal push)
  if p_stars = 5 then
    insert into public.push_queue (kind, user_id, title, body, url)
    values ('reporter', v_reporter, '⭐ మీ వార్తకు 5 స్టార్ రేటింగ్!', v_title, '/n/' || p_post_id);
  end if;
end $$;

-- Bayesian average so a reporter with 2 ratings of 5★ doesn't outrank one with 300 ratings of 4.7★
create or replace view public.reporter_stats as
with g as (select coalesce(avg(stars), 4.0) as m from public.story_ratings),
     r as (select reporter_id, count(*) n, avg(stars) a, sum(stars) s from public.story_ratings group by reporter_id),
     p as (select reporter_id, count(*) stories, coalesce(sum(views), 0) views
           from public.posts where status = 'published' group by reporter_id)
select pr.id as reporter_id, pr.full_name, pr.photo_url, pr.slug, pr.verified, pr.experience_years, pr.district_id,
       coalesce(p.stories, 0) as stories, coalesce(p.views, 0) as views,
       coalesce(r.n, 0) as ratings_count,
       round(coalesce(r.a, 0)::numeric, 1) as avg_stars,
       round(((10 * g.m + coalesce(r.s, 0)) / (10 + coalesce(r.n, 0)))::numeric, 2) as rank_score
from public.profiles pr cross join g
left join r on r.reporter_id = pr.id
left join p on p.reporter_id = pr.id
where pr.role = 'reporter';

-------------------------------------------------------------------------------
-- 3) SHARE TRACKING (which reporter's shares bring readers / installs)
-------------------------------------------------------------------------------
create table if not exists public.share_events (
  id          bigserial primary key,
  post_id     bigint,
  reporter_id uuid,
  shared_by   uuid,
  channel     text,          -- whatsapp | instagram | facebook | x | other
  kind        text,          -- clipping | reporter_card | link
  created_at  timestamptz default now()
);
create table if not exists public.link_opens (
  id          bigserial primary key,
  path        text,          -- /n/2481 or /r/slug
  ref         text,          -- ?ref=<reporter slug> from the shared link
  user_agent  text,
  opened_in   text,          -- app | web
  created_at  timestamptz default now()
);
alter table public.share_events enable row level security;
alter table public.link_opens  enable row level security;
create policy "insert shares" on public.share_events for insert with check (true);
create policy "insert opens"  on public.link_opens  for insert with check (true);

-------------------------------------------------------------------------------
-- 4) Drain the push queue every minute (needs pg_cron + pg_net). Replace <PROJECT_REF>/<CRON_SECRET>.
-------------------------------------------------------------------------------
select cron.schedule('push-drain', '* * * * *', $$
  select net.http_post(url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-push',
                       headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
                       body := '{"drain":true}'::jsonb) $$);
