-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 1 — BACKUP + SAFE ADDITIONS            (run now, before giving out app v2.35)
-- RTI Express Spot News 24x7 · Nov 2026
--
-- What this does NOT do:  it does not change, move or delete any existing row,
-- and it does not change how the Play Store version (v2.34 and older) works.
-- It only (a) makes a backup copy of your tables and (b) ADDS new things that only
-- the new app uses. Safe to run more than once.
-- ═════════════════════════════════════════════════════════════════════════════

-- (a) BACKUP — a full copy of the tables this update touches, in a separate
--     schema "backup_nov2026". The app never reads it. Taken only the first time.
create schema if not exists backup_nov2026;
do $$
declare t text;
begin
  foreach t in array array['clippings','reporter_applications','profiles','local_ads','app_config',
                           'lipping_comments','clipping_comments','daily_posts'] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t)
       and not exists (select 1 from information_schema.tables where table_schema = 'backup_nov2026' and table_name = t) then
      execute format('create table backup_nov2026.%I as table public.%I', t, t);
      raise notice 'Backed up public.% ', t;
    end if;
  end loop;
end $$;
-- Keep the backup private (no access through the app's public key)
revoke all on schema backup_nov2026 from anon, authenticated;

-- (b1) Reporter registration: new EMPTY columns (old rows keep their values)
alter table public.reporter_applications add column if not exists user_id uuid;
alter table public.reporter_applications add column if not exists photo_url text;
alter table public.reporter_applications add column if not exists aadhaar_doc_path text;
alter table public.reporter_applications add column if not exists press_id_doc_path text;
alter table public.reporter_applications add column if not exists id_card_status text default 'none';
alter table public.reporter_applications add column if not exists terms_accepted_at timestamptz;
alter table public.reporter_applications add column if not exists terms_version text;
create index if not exists reporter_applications_phone_idx on public.reporter_applications (phone);
create index if not exists reporter_applications_user_idx on public.reporter_applications (user_id);

-- (b2) Private storage bucket for Aadhaar / old press ID (new, empty)
insert into storage.buckets (id, name, public)
values ('reporter-docs', 'reporter-docs', false)
on conflict (id) do nothing;

-- (b3) Brand deals — a NEW table (replaces Google AdMob in the new app only)
create table if not exists public.brand_ads (
  id              uuid primary key default gen_random_uuid(),
  brand           text not null,
  title_te        text not null,
  title_en        text,
  subtitle_te     text,
  image_url       text,
  cta_label       text,
  affiliate_url   text not null check (affiliate_url ~* '^https://'),
  accent_color    text,
  target_state    text,          -- null / 'All' = every state
  target_district text,          -- null / 'All' = every district
  priority        int  not null default 0,
  active          boolean not null default true,
  starts_at       timestamptz,
  ends_at         timestamptz,
  impressions     bigint not null default 0,
  clicks          bigint not null default 0,
  created_at      timestamptz not null default now()
);

-- Only major, well-known shopping brands. Add a brand here when you sign up for its affiliate programme.
alter table public.brand_ads drop constraint if exists brand_ads_brand_allowed;
alter table public.brand_ads add constraint brand_ads_brand_allowed check (brand in (
  'Amazon','Flipkart','Meesho','Myntra','Ajio','JioMart','Nykaa','Tata CLiQ','BigBasket','Croma','Reliance Digital'
));

create index if not exists brand_ads_active_idx on public.brand_ads (active, priority desc);

alter table public.brand_ads enable row level security;

drop policy if exists "brand_ads public read active" on public.brand_ads;
create policy "brand_ads public read active" on public.brand_ads
  for select using (
    active = true
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin'))
  );

drop policy if exists "brand_ads admin write" on public.brand_ads;
create policy "brand_ads admin write" on public.brand_ads
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','superadmin')));

-- Counters (readers cannot edit the table, so they go through this function)
create or replace function public.brand_ad_event(p_id uuid, p_kind text)
returns void language sql security definer set search_path = public as $$
  update public.brand_ads
     set impressions = impressions + case when p_kind = 'impression' then 1 else 0 end,
         clicks      = clicks      + case when p_kind = 'click'      then 1 else 0 end
   where id = p_id and active = true;
$$;
grant execute on function public.brand_ad_event(uuid, text) to anon, authenticated;

-- (b4) Comments from readers without login: ADD a permission (existing permissions stay as they are)
do $$
declare t text;
begin
  foreach t in array array['lipping_comments', 'clipping_comments'] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      begin
        execute format('drop policy if exists "comments public read" on public.%I', t);
        execute format('create policy "comments public read" on public.%I for select using (true)', t);
        execute format('drop policy if exists "comments anyone insert" on public.%I', t);
        execute format($p$create policy "comments anyone insert" on public.%I for insert
                         with check (char_length(coalesce(text, '')) between 1 and 500
                                     and char_length(coalesce(user_name, '')) between 1 and 60)$p$, t);
      exception when others then
        raise notice 'Comments permission on % skipped: %', t, sqlerrm;
      end;
    end if;
  end loop;
end $$;

-- (b5) Daily posts: allow the two new kinds (only widens what is allowed)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'daily_posts') then
    alter table public.daily_posts drop constraint if exists daily_posts_kind_check;
    alter table public.daily_posts add constraint daily_posts_kind_check
      check (kind in ('morning','weather','agri','diet','health','exercise','sustainability','night',
                     'affirmation','career','tech','youth','mindcare','sleep','deals','quote'));
  end if;
end $$;

-- Check: number of rows in your tables vs the backup (both columns should match)
select 'clippings' as table_name, (select count(*) from public.clippings) as live_rows,
       (select count(*) from backup_nov2026.clippings) as backup_rows
union all
select 'reporter_applications', (select count(*) from public.reporter_applications),
       (select count(*) from backup_nov2026.reporter_applications);
