-- Migration 085: rodapé/slogan configurável por clínica nos relatórios (PDF).
-- Usado no rodapé de todos os documentos gerados (Neuro ID 360).
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS report_tagline text;

UPDATE public.clinics
  SET report_tagline = 'TRUE MOVEMENT ARISES FROM THE FLOW OF YOUR IDENTITY'
  WHERE report_tagline IS NULL;

NOTIFY pgrst, 'reload schema';
