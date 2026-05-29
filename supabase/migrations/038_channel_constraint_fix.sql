-- Migration 038: UX-04 — expand channel check constraints to include 'whatsapp' and 'none'
-- The original schema only allowed ('email', 'sms') for channel in follow_ups and
-- communication_logs. The automation service uses 'whatsapp' and 'none', causing
-- all WhatsApp-channel inserts to fail silently with check constraint violations.

-- ── follow_ups.channel ───────────────────────────────────────────────────────
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.follow_ups'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%channel%';
  if cname is not null then
    execute format('alter table public.follow_ups drop constraint %I', cname);
  end if;
end $$;

alter table public.follow_ups
  add constraint follow_ups_channel_check
  check (channel in ('email', 'sms', 'whatsapp', 'none'));

-- ── communication_logs.channel ───────────────────────────────────────────────
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.communication_logs'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%channel%';
  if cname is not null then
    execute format('alter table public.communication_logs drop constraint %I', cname);
  end if;
end $$;

alter table public.communication_logs
  add constraint communication_logs_channel_check
  check (channel in ('email', 'sms', 'whatsapp', 'none'));

-- ── communication_templates.channel (if same constraint exists) ──────────────
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.communication_templates'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%channel%';
  if cname is not null then
    execute format('alter table public.communication_templates drop constraint %I', cname);
    alter table public.communication_templates
      add constraint communication_templates_channel_check
      check (channel in ('email', 'sms', 'whatsapp', 'none'));
  end if;
end $$;
