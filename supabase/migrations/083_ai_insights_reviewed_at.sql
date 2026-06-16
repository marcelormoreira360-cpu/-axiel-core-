-- Migration 083: drift de schema — ai_insights.reviewed_at
-- approveAiInsightAsFinal grava reviewed_at ao aprovar; a coluna não existia
-- em produção (erro PGRST204 "Could not find the 'reviewed_at' column" ao aprovar).
ALTER TABLE public.ai_insights
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

NOTIFY pgrst, 'reload schema';
