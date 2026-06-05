-- migration 064_template_send_on_first_appointment.sql
-- Questionários automáticos: marca templates para enviar na 1ª sessão do paciente.
alter table public.assessment_templates
  add column if not exists send_on_first_appointment boolean not null default false;

notify pgrst, 'reload schema';
