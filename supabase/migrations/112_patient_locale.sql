-- 112: idioma preferido do PACIENTE (null = herda o da clínica).
-- Base do projeto "locale do paciente ponta a ponta": clínica nos EUA com
-- terapeuta pt-BR mandava tudo em português ao paciente americano.
-- Captura: booking público e cadastro público (cookie AXIEL_LOCALE) + campo
-- "Idioma das mensagens" na ficha de edição. Consumo: resolvePatientLocale
-- (lib/email-i18n) em confirmações, lembretes D-1, NPS, D+3/D+30 e e-mails.
alter table public.patients
  add column if not exists locale text
  check (locale is null or locale in ('pt-BR', 'en', 'pt-PT'));
