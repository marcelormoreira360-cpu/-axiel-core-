-- 094_patient_demographics.sql
-- Fonte única da demografia no cadastro do paciente (date_of_birth e city já existem).
-- A idade NÃO é armazenada — é derivada de date_of_birth em runtime (ageFromDob).
-- RLS de patients já vale. ⚠️ NÃO aplicada automaticamente — aguardando OK.
alter table public.patients
  add column if not exists sex        text,
  add column if not exists weight_kg  numeric,
  add column if not exists height_cm  numeric;

comment on column public.patients.sex is 'Sexo/gênero informado (texto livre).';
comment on column public.patients.weight_kg is 'Peso em kg.';
comment on column public.patients.height_cm is 'Altura em cm.';
