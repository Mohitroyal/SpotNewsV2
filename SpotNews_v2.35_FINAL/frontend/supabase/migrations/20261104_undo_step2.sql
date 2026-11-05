-- UNDO STEP 2 — turns approval back on and restores old statuses from the backup.

drop trigger if exists trg_clippings_enforce_limits on public.clippings;

do $$
declare old_value text;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_config') then
    select config_value into old_value from backup_nov2026.app_config where config_key = 'auto_approve_clippings' limit 1;
    update public.app_config set config_value = coalesce(old_value, 'false') where config_key = 'auto_approve_clippings';
  end if;
end $$;

-- Clippings that were waiting for approval before step 2 go back to waiting
update public.clippings c
   set status = b.status, is_posted = b.is_posted
  from backup_nov2026.clippings b
 where c.id = b.id and b.status = 'pending_approval';

-- Local ads go back to their old status
update public.local_ads a
   set status = b.status
  from backup_nov2026.local_ads b
 where a.id = b.id and b.status in ('pending', 'accepted_payment_pending');
