-- 087_treatment_plan_value.sql
-- Valor do plano de cuidado (Etapa 4 da Jornada do Paciente).
-- Coluna única, opcional. Moeda = moeda da clínica (consistente com o app).
alter table public.treatment_plans
  add column if not exists plan_value_cents integer;

comment on column public.treatment_plans.plan_value_cents is
  'Valor do plano de cuidado em centavos, na moeda da clinica. Opcional.';
