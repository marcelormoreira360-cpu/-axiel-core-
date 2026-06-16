-- Migration 082: drift de schema em ai_insights (Neuro ID 360)
-- saveAiInsight insere ai_request_id e safety_label, que não existiam em produção.
ALTER TABLE public.ai_insights
  ADD COLUMN IF NOT EXISTS ai_request_id uuid REFERENCES public.ai_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS safety_label  text;

NOTIFY pgrst, 'reload schema';
