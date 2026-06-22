-- 100_functional_exam_metrics.sql
-- Fusão Bio³ (incrementos 3–4): métricas numéricas extraídas do PDF do exame
-- (neurometria/biorressonância), com GATE HUMANO. A IA propõe um rascunho; o
-- terapeuta revisa/edita e CONFIRMA antes de os valores entrarem na pirâmide Bio³.
alter table public.patient_functional_exams
  add column if not exists metrics_draft      jsonb,        -- rascunho da IA { metric_code: valor bruto } (auditoria do que a IA leu)
  add column if not exists metrics_values      jsonb,        -- valores revisados/confirmados pelo terapeuta (estes entram na pirâmide)
  add column if not exists metrics_reviewed_at timestamptz,  -- quando o terapeuta confirmou (gate). Null = pendente de revisão
  add column if not exists metrics_reviewed_by uuid references public.users(id) on delete set null;

comment on column public.patient_functional_exams.metrics_draft is 'Rascunho da IA: { metric_code: valor bruto } extraído do exame (auditoria; NÃO entra na pirâmide sem revisão humana).';
comment on column public.patient_functional_exams.metrics_values is 'Valores das métricas revisados/confirmados pelo terapeuta — estes alimentam a pirâmide Bio³.';
comment on column public.patient_functional_exams.metrics_reviewed_at is 'Quando o terapeuta confirmou as métricas (gate humano). Null = pendente.';

notify pgrst, 'reload schema';
