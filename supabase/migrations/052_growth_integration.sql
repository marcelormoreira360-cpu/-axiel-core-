-- =============================================================================
-- 052_growth_integration.sql
-- Integração AXIEL Growth → AXIEL Core (handoff de lead quente).
-- Cria: chave de integração por clínica + campos de lead vindos do Growth.
-- Não insere dados. Seguro para aplicar antes do deploy do código.
-- =============================================================================

-- 1) Nova origem de lead (não é usada nesta migration, só registrada no enum).
--    PG15: ADD VALUE fora de transação que o utilize é seguro.
alter type public.lead_source add value if not exists 'axiel_growth';

-- 2) Campos novos em leads para o contexto de aquecimento do Growth.
alter table public.leads
  add column if not exists score int not null default 0,           -- 0-100 (leads.score do Growth)
  add column if not exists growth_lead_id text,                     -- leads.id do Growth (idempotência)
  add column if not exists warming_context jsonb not null default '{}';  -- interest/pain/plataforma/consent/stage do Growth

-- Idempotência: um lead do Growth mapeia para no máximo 1 lead por clínica.
create unique index if not exists leads_clinic_growth_lead_uq
  on public.leads (clinic_id, growth_lead_id)
  where growth_lead_id is not null;

-- 3) Chaves de integração por clínica (auth do webhook Growth → Core).
create table if not exists public.clinic_integration_keys (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  provider    text not null default 'axiel_growth',   -- preparado p/ outros provedores
  label       text,                                    -- nome amigável definido pela clínica
  key_hash    text not null,                           -- SHA-256 da chave (a chave em si nunca é guardada)
  key_prefix  text,                                    -- primeiros chars p/ exibir "axg_ab12…" na UI
  is_active   boolean not null default true,
  last_used_at timestamptz,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Lookup rápido no hot path do webhook
create unique index if not exists clinic_integration_keys_hash_uq
  on public.clinic_integration_keys (key_hash);
create index if not exists clinic_integration_keys_clinic_idx
  on public.clinic_integration_keys (clinic_id, provider) where is_active;

-- RLS: cada clínica só enxerga/gerencia as próprias chaves.
alter table public.clinic_integration_keys enable row level security;

drop policy if exists integration_keys_manage on public.clinic_integration_keys;
create policy integration_keys_manage on public.clinic_integration_keys
  for all using (public.can_manage_clinic(clinic_id))
  with check (public.can_manage_clinic(clinic_id));

-- Observação: o webhook valida a chave com o SERVICE ROLE (admin client), que
-- ignora RLS — então o endpoint resolve clinic_id a partir do key_hash mesmo
-- sem sessão de usuário (igual ao bot do WhatsApp/Instagram).
