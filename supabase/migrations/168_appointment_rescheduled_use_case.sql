-- 168: use_case 'appointment_rescheduled' em communication_logs — aviso automático
-- ao paciente quando o horário de uma sessão futura muda (updateAppointment).
-- Sem este valor na constraint, o log do envio (WhatsApp/e-mail) seria rejeitado.
-- Mesmo padrão das migrations 036/075/111/113: derruba a constraint atual e recria
-- com a lista completa + o novo valor.
do $$
declare cname text;
begin
  for cname in
    select conname from pg_constraint
    where conrelid = 'public.communication_logs'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) like '%use_case%'
  loop
    execute format('alter table public.communication_logs drop constraint %I', cname);
  end loop;
end $$;

alter table public.communication_logs
  add constraint communication_logs_use_case_check
  check (use_case in (
    'appointment_reminder','follow_up','lead_nurturing','nps_feedback',
    'appointment_confirmation','appointment_rescheduled','package_low','dunning',
    'trial_expiry_d3','trial_expiry_d1','neuro_id_report','monthly_report'
  ));
