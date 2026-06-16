-- Migration 081: drift de schema em ai_requests (Neuro ID 360)
-- completeAiRequest grava colunas que não existiam em produção
-- (erro PGRST204 "Could not find the 'error_message' column" ao gerar insight).
ALTER TABLE public.ai_requests
  ADD COLUMN IF NOT EXISTS output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_message  text,
  ADD COLUMN IF NOT EXISTS tokens_used    integer,
  ADD COLUMN IF NOT EXISTS fallback_used  boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
