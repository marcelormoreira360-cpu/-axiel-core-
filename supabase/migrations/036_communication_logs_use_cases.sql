-- Migration 036: BUG-03 — expand communication_logs.use_case check constraint
-- The original constraint only allowed ('appointment_reminder', 'follow_up', 'lead_nurturing').
-- The automation service uses 'nps_feedback', 'appointment_confirmation', and 'package_low',
-- causing all those inserts to fail silently with check constraint violations.

-- Drop and recreate the constraint with the full set of valid values.
alter table public.communication_logs
  drop constraint if exists communication_logs_use_case_check;

alter table public.communication_logs
  drop constraint if exists communication_logs_use_case_check1;

-- Also drop if named after the column (Postgres auto-naming convention)
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.communication_logs'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%use_case%';
  if cname is not null then
    execute format('alter table public.communication_logs drop constraint %I', cname);
  end if;
end $$;

alter table public.communication_logs
  add constraint communication_logs_use_case_check
  check (use_case in (
    'appointment_reminder',
    'follow_up',
    'lead_nurturing',
    'nps_feedback',
    'appointment_confirmation',
    'package_low'
  ));

-- Same fix for communication_templates if it has the same constraint
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.communication_templates'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%use_case%';
  if cname is not null then
    execute format('alter table public.communication_templates drop constraint %I', cname);
    alter table public.communication_templates
      add constraint communication_templates_use_case_check
      check (use_case in (
        'appointment_reminder',
        'follow_up',
        'lead_nurturing',
        'nps_feedback',
        'appointment_confirmation',
        'package_low'
      ));
  end if;
end $$;
