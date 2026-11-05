-- UNDO STEP 1 — removes only what 1_BACKUP_AND_SAFE_ADDITIONS.sql added.
-- Your existing data is not touched. The backup schema is KEPT (delete it yourself later if you want:
--   drop schema backup_nov2026 cascade;)

drop table if exists public.brand_ads cascade;
drop function if exists public.brand_ad_event(uuid, text);

alter table public.reporter_applications drop column if exists user_id;
alter table public.reporter_applications drop column if exists photo_url;
alter table public.reporter_applications drop column if exists aadhaar_doc_path;
alter table public.reporter_applications drop column if exists press_id_doc_path;
alter table public.reporter_applications drop column if exists id_card_status;
alter table public.reporter_applications drop column if exists terms_accepted_at;
alter table public.reporter_applications drop column if exists terms_version;
drop index if exists public.reporter_applications_phone_idx;
drop index if exists public.reporter_applications_user_idx;

do $$
declare t text;
begin
  foreach t in array array['lipping_comments', 'clipping_comments'] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('drop policy if exists "comments public read" on public.%I', t);
      execute format('drop policy if exists "comments anyone insert" on public.%I', t);
    end if;
  end loop;
end $$;
-- The empty private bucket "reporter-docs" can be deleted in Storage if you want.
