-- =============================================================================
-- 166_supplement_regen_sent.sql
-- Fase 4 (envio em lote): rastreia o ENVIO da suplementação regenerada no próprio
-- job. Um job 'done' cujo rascunho o gestor já APROVOU (ai_insights.review_status
-- = 'final') e que ainda não foi enviado (sent_at null) é "pronto para enviar".
-- O envio em lote respeita o gate humano: só envia o que já foi aprovado.
--
-- Não insere dados. Aditiva. Aplicar em produção após a 165.
-- =============================================================================

alter table public.supplement_regeneration_jobs
  add column if not exists sent_at    timestamptz,
  add column if not exists send_error text;

-- Hot path: prováveis "prontos para enviar" (done + ainda não enviados) por clínica.
create index if not exists supplement_regen_jobs_sendable_idx
  on public.supplement_regeneration_jobs (clinic_id)
  where status = 'done' and sent_at is null;

notify pgrst, 'reload schema';
