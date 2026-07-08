-- Idioma do questionário. O envio automático no 1º agendamento passa a escolher
-- a versão do formulário que casa com o idioma do paciente (patients.locale).
-- Default pt-BR: todos os templates existentes ficam pt-BR; as versões em inglês
-- são marcadas 'en' por dado (ver update abaixo, feito fora da migration por clínica).
alter table public.assessment_templates
  add column if not exists locale text not null default 'pt-BR';

-- Índice para o filtro (clinic_id, send_on_first_appointment, locale) do onboarding.
create index if not exists idx_assessment_templates_clinic_send_locale
  on public.assessment_templates (clinic_id, send_on_first_appointment, locale)
  where deleted_at is null;
