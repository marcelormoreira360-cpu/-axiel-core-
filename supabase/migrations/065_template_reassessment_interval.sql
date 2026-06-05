-- migration 065_template_reassessment_interval.sql
-- Reavaliação automática: intervalo (em dias) para reenviar o questionário ao
-- paciente. 0 = desligado. Ex.: 30 = mensal.
alter table public.assessment_templates
  add column if not exists reassessment_interval_days integer not null default 0;

notify pgrst, 'reload schema';
