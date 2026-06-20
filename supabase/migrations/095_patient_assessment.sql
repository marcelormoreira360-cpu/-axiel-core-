-- 095_patient_assessment.sql
-- Seção "Avaliação" (espaços de escrita do terapeuta) na ficha do paciente.
-- Fonte única em patients; lido pelo Bio³/relatórios. Aditivo, RLS de patients já vale.
alter table public.patients
  add column if not exists anamnese        text,
  add column if not exists antecedents     text,
  add column if not exists pain_level       numeric,
  add column if not exists pain_location   text,
  add column if not exists treatment_note  text;

comment on column public.patients.anamnese is 'Anamnese / narrativa do paciente (texto livre do terapeuta).';
comment on column public.patients.antecedents is 'Antecedentes e histórico cirúrgico (o que não vem dos questionários).';
comment on column public.patients.pain_level is 'Grau de dor 0–10 informado na avaliação.';
comment on column public.patients.pain_location is 'Local da dor (texto; mapa anatômico visual virá depois).';
comment on column public.patients.treatment_note is 'Conduta/tratamento sugerido pelo terapeuta — entra no 1º relatório.';
