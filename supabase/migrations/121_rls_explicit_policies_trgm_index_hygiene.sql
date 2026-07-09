-- 121: higiene do banco (advisors 2026-07-09)
-- (a) policies explícitas nas 5 tabelas com RLS ligada e nenhuma policy
-- (b) pg_trgm fora do schema public
-- (c) drop de 17 índices sem uso comprovadamente cosméticos
--
-- NOTA sobre o advisor "unused_index" (147 itens): 113 deles cobrem FOREIGN KEYS
-- (dropar reintroduziria o warning pior de unindexed_foreign_keys) e a maior parte
-- do resto são lookups críticos com estatísticas jovens (token_hash de convite/portal,
-- rate_limit_buckets, cron_runs, roteamento meta_phone/instagram, stripe/zoom ids,
-- trgm da busca de pacientes). Esses ficam. Só caem os 17 abaixo.

-- (a) Tabelas infra: leitura para platform admin; escrita segue só via service role.
create policy "Platform admins can view cron runs" on public.cron_runs
  for select to authenticated using (is_platform_admin());
create policy "Platform admins can view processed messages" on public.meta_processed_messages
  for select to authenticated using (is_platform_admin());
-- Tabelas com clinic_id: leitura para membros da própria clínica.
create policy "Clinic members can view hotmart purchases" on public.hotmart_purchases
  for select to authenticated using (can_access_clinic(clinic_id));
-- whatsapp_conversations/interactions têm clinic_id TEXT (legado) -> cast protegido por regex
create policy "Clinic members can view whatsapp conversations" on public.whatsapp_conversations
  for select to authenticated using (
    case when clinic_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then can_access_clinic(clinic_id::uuid) else false end
  );
create policy "Clinic members can view whatsapp interactions" on public.whatsapp_interactions
  for select to authenticated using (
    case when clinic_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then can_access_clinic(clinic_id::uuid) else false end
  );

-- (b) pg_trgm: o search_path do banco já inclui "extensions"; os índices trgm
-- existentes continuam válidos (referência por OID).
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

-- (c) Índices sem uso (idx_scan=0), sem FK na coluna líder e sem papel de lookup.
-- Rollback: as definições originais estão comentadas ao lado de cada drop.
drop index if exists public.action_suggestions_priority_idx;        -- btree (priority)
drop index if exists public.ai_insights_approved_at_idx;            -- btree (approved_at DESC)
drop index if exists public.ai_insights_created_at_idx;             -- btree (created_at DESC)
drop index if exists public.ai_validation_events_created_at_idx;    -- btree (created_at DESC)
drop index if exists public.appointments_source_idx;                -- btree (source)
drop index if exists public.billing_events_created_at_idx;          -- btree (created_at DESC)
drop index if exists public.billing_events_event_type_idx;          -- btree (event_type)
drop index if exists public.communication_logs_created_at_idx;      -- btree (created_at)
drop index if exists public.idx_follow_ups_notes_pattern;           -- btree (notes text_pattern_ops)
drop index if exists public.hotmart_purchases_created_at_idx;       -- btree (created_at DESC)
drop index if exists public.hotmart_purchases_status_idx;           -- btree (status)
drop index if exists public.leads_main_complaint_idx;               -- gin to_tsvector('english', main_complaint) — config errada p/ conteúdo PT
drop index if exists public.leads_stage_idx;                        -- btree (stage)
drop index if exists public.monetization_offers_offer_type_idx;     -- btree (offer_type)
drop index if exists public.patient_offers_status_idx;              -- btree (status)
drop index if exists public.product_orders_status_idx;              -- btree (status)
drop index if exists public.idx_session_records_soap_mode;          -- btree (soap_mode) where soap_mode=true
