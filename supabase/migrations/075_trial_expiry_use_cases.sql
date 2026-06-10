-- Migration 075 (✅ APLICADA em produção 10/06/2026): expande communication_logs.use_case para os avisos de trial
-- expirando (D-3 e D-1) usados pelo trial-expiry-service, e inclui 'dunning'
-- (já usado pelo dunning-service mas ausente do check constraint anterior).
-- Mesmo padrão da migration 036.

do $$
declare
  cname text;
begin
  for cname in
    select conname
    from pg_constraint
    where conrelid = 'public.communication_logs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%use_case%'
  loop
    execute format('alter table public.communication_logs drop constraint %I', cname);
  end loop;
end $$;

alter table public.communication_logs
  add constraint communication_logs_use_case_check
  check (use_case in (
    'appointment_reminder',
    'follow_up',
    'lead_nurturing',
    'nps_feedback',
    'appointment_confirmation',
    'package_low',
    'dunning',
    'trial_expiry_d3',
    'trial_expiry_d1'
  ));
