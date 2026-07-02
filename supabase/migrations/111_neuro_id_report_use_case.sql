-- Migration 111: expande communication_logs.use_case para 'neuro_id_report'
-- (envio manual do relatório Bio³/Neuro ID ao paciente, botão "Enviar ao paciente"
-- no painel do Mapa Bio³). Mesmo padrão das migrations 036 e 075.

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
    'trial_expiry_d1',
    'neuro_id_report'
  ));
