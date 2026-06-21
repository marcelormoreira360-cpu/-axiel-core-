-- 099_functional_exam_ai_analysis.sql
-- Anexar arquivo do exame (PDF) + análise da IA (emoções/achados concisos p/ relatório).
alter table public.patient_functional_exams
  add column if not exists file_path   text,   -- caminho no bucket patient-docs
  add column if not exists ai_analysis text;   -- síntese gerada pela IA (entra no Doc 1)
comment on column public.patient_functional_exams.file_path is 'Arquivo do exame (PDF) no bucket patient-docs.';
comment on column public.patient_functional_exams.ai_analysis is 'Síntese concisa gerada pela IA a partir do exame (ex.: emoções mais alteradas).';
