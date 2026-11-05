-- New daily segments (career, tech, youth, mind care, sleep, deals, affirmations, quotes)
-- Safe to run on LIVE or TEST at any time. Only widens the allowed "kind" list; no data changes.
-- Old app versions are not affected (they only read the kinds they know).
do $$
begin
  if to_regclass('public.daily_posts') is not null then
    alter table public.daily_posts drop constraint if exists daily_posts_kind_check;
    alter table public.daily_posts add constraint daily_posts_kind_check
      check (kind in ('morning','weather','agri','diet','health','exercise','sustainability','night',
                     'affirmation','career','tech','youth','mindcare','sleep','deals','quote'));
  end if;
end $$;
select 'new daily segments: OK' as result;
