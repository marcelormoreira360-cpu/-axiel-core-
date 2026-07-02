-- 113: use_case 'monthly_report' em communication_logs (dedup por clínica/mês
-- do relatório mensal — sem o log, um retry do cron mandava o e-mail em dobro).
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
    'appointment_confirmation','package_low','dunning',
    'trial_expiry_d3','trial_expiry_d1','neuro_id_report','monthly_report'
  ));
