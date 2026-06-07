-- migration 067_patient_case_summary.sql
-- Feature 2: queixa principal fixa + resumo do caso sempre à vista.
-- chief_complaint = queixa principal (texto curto, fixo no topo da ficha e da sessão).
-- case_summary    = resumo do caso (o terapeuta atualiza ao longo do tratamento).
alter table public.patients
  add column if not exists chief_complaint text,
  add column if not exists case_summary text;

notify pgrst, 'reload schema';
