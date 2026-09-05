-- Migration 150: Fundação do Módulo Financeiro (ERP) — Fase 1
--
-- Ver _BRIEF_FINANCEIRO_ERP.md. Escopo desta fase:
--   1. fin_entries: o RAZÃO ÚNICO de lançamentos (receita/despesa). As fontes que
--      já existem (patient_payments, repasse, subscriptions) NÃO são duplicadas
--      aqui — o Dashboard Executivo consolida elas em tempo de leitura. fin_entries
--      guarda os lançamentos MANUAIS (despesas, receitas fora de pagamento) e, em
--      fases futuras, espelhos por `source`/`source_id` quando fizer sentido.
--   2. fin_audit: log append-only de alterações no financeiro (quem/quando/o quê).
--
-- Multi-tenant: tudo escopado por clinic_id, RLS de LEITURA por can_access_clinic.
-- ESCRITA é feita pelo servidor (admin client), gated por requireFinanceAccess
-- (dono/gestor) — mesmo padrão dos logs de status. Idempotente.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Razão único de lançamentos financeiros.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.fin_entries (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics(id) on delete cascade,
  kind          text not null check (kind in ('revenue','expense')),
  amount_cents  integer not null check (amount_cents >= 0),
  currency      text not null default 'BRL',
  entry_date    date not null default current_date,      -- competência
  category      text,                                    -- texto por enquanto (Fase 4: tabela)
  business_unit text not null default 'clinica',          -- clinica | saas | b2b | produtos ...
  method        text,                                    -- dinheiro | pix | cartao | transferencia ...
  description   text,
  source        text not null default 'manual' check (source in ('manual','patient_payment','repasse','subscription','order')),
  source_id     uuid,                                    -- id da fonte quando espelhado (evita duplicar)
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists fin_entries_clinic_date_idx on public.fin_entries(clinic_id, entry_date);
create index if not exists fin_entries_clinic_kind_idx  on public.fin_entries(clinic_id, kind);
-- Dedup de espelho: no máximo 1 lançamento por fonte externa.
create unique index if not exists fin_entries_source_uidx
  on public.fin_entries(clinic_id, source, source_id)
  where source <> 'manual' and source_id is not null;

alter table public.fin_entries enable row level security;

drop policy if exists "Clinic users can view fin entries" on public.fin_entries;
create policy "Clinic users can view fin entries"
  on public.fin_entries for select to authenticated
  using (public.can_access_clinic(clinic_id));

comment on table public.fin_entries is
  'Razão único do módulo financeiro (Fase 1). Lançamentos manuais + espelhos por source/source_id. Leitura RLS por clínica; escrita via servidor (requireFinanceAccess).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Auditoria append-only do financeiro.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.fin_audit (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  entity      text not null,                 -- 'fin_entry' ...
  entity_id   uuid,
  action      text not null,                 -- 'create' | 'update' | 'delete'
  changed_by  uuid references public.users(id) on delete set null,
  diff        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists fin_audit_clinic_created_idx on public.fin_audit(clinic_id, created_at);

alter table public.fin_audit enable row level security;

drop policy if exists "Clinic users can view fin audit" on public.fin_audit;
create policy "Clinic users can view fin audit"
  on public.fin_audit for select to authenticated
  using (public.can_access_clinic(clinic_id));

comment on table public.fin_audit is
  'Log append-only de alterações no módulo financeiro. Escrita via servidor.';
