-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 2 — SWITCH ON "NO APPROVAL"     (run LATER, after v2.35 is live on the Play Store)
--
-- This is the only file that changes how things work for everyone, old app included:
--   • clippings from approved reporters go live without admin approval
--   • clippings waiting for approval (with an image) are published
--   • local ads waiting for approval go live
--   • headline ≤ 6 words / article ≤ 50 words enforced for every app version
-- To go back: run UNDO_2.sql (it restores the old statuses from the backup).
-- ═════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'backup_nov2026' and table_name = 'clippings') then
    raise exception 'Run 1_BACKUP_AND_SAFE_ADDITIONS.sql first';
  end if;
end $$;

-- 1) No admin approval for clippings (Django reads this switch)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_config') then
    update public.app_config set config_value = 'true' where config_key = 'auto_approve_clippings';
    if not found then
      insert into public.app_config (config_key, config_value) values ('auto_approve_clippings', 'true');
    end if;
  end if;
end $$;

-- 2) Publish clippings that were waiting for approval
update public.clippings
   set status = 'approved', is_posted = true
 where status = 'pending_approval' and coalesce(png_url, '') <> '';

-- 3) Local ads go live at once (admin can still pause / delete)
update public.local_ads set status = 'active' where status in ('pending', 'accepted_payment_pending');

-- 4) Word limits for every app version (only applies when a clipping is created or its text is edited)
create or replace function public.limit_words(p_text text, p_max int)
returns text language sql immutable as $$
  select case
    when p_text is null then null
    when coalesce(array_length(regexp_split_to_array(btrim(p_text), '\s+'), 1), 0) <= p_max then p_text
    else array_to_string((regexp_split_to_array(btrim(p_text), '\s+'))[1:p_max], ' ')
  end
$$;

create or replace function public.clippings_enforce_limits()
returns trigger language plpgsql as $$
begin
  new.headline        := public.limit_words(new.headline, 6);
  new.article_content := public.limit_words(new.article_content, 50);
  return new;
end $$;

drop trigger if exists trg_clippings_enforce_limits on public.clippings;
create trigger trg_clippings_enforce_limits
  before insert or update of headline, article_content on public.clippings
  for each row execute function public.clippings_enforce_limits();
