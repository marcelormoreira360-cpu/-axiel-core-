-- Migration 151: Contas a Pagar + Fornecedores + Recorrentes — ERP Fase 3
--
-- Ver _BRIEF_FINANCEIRO_ERP.md (Fase 3). Escopo:
--   1. fin_suppliers  — fornecedores da clínica.
--   2. fin_recurring  — modelos de despesa recorrente (assinatura, aluguel, payroll fixo).
--                       "Gerar contas do mês" materializa cada recorrente ativa em uma conta a pagar.
--   3. fin_payables   — contas a pagar (a vencer/vencidas). Ao PAGAR, geram um lançamento
--                       de despesa no razão único (fin_entries, source='payable') — por isso
--                       aparecem automaticamente no Dashboard Executivo e no Fluxo de Caixa,
--                       sem número calculado em dois lugares.
--
-- Multi-tenant: tudo escopado por clinic_id, RLS de LEITURA por can_access_clinic.
-- ESCRITA é feita pelo servidor (admin client), gated por requireFinanceAccess
-- (dono/gestor) — mesmo padrão da Fase 1/2. Idempotente.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. O razão agora aceita a fonte 'payable' (conta a pagar quitada).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.fin_entries drop constraint if exists fin_entries_source_check;
alter table public.fin_entries add constraint fin_entries_source_check
  check (source in ('manual','patient_payment','repasse','subscription','order','payable'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Fornecedores.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.fin_suppliers (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  name        text not null,
  notes       text,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists fin_suppliers_clinic_idx on public.fin_suppliers(clinic_id);
-- Um fornecedor por nome (case-insensitive) dentro da clínica.
create unique index if not exists fin_suppliers_clinic_name_uidx
  on public.fin_suppliers(clinic_id, lower(name));

alter table public.fin_suppliers enable row level security;
drop policy if exists "Clinic users can view fin suppliers" on public.fin_suppliers;
create policy "Clinic users can view fin suppliers"
  on public.fin_suppliers for select to authenticated
  using (public.can_access_clinic(clinic_id));

comment on table public.fin_suppliers is
  'Fornecedores do módulo financeiro (Fase 3). Leitura RLS por clínica; escrita via servidor (requireFinanceAccess).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Despesas recorrentes (modelo). Cadência mensal por dia do mês (MVP).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.fin_recurring (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics(id) on delete cascade,
  supplier_id   uuid references public.fin_suppliers(id) on delete set null,
  description   text not null,
  amount_cents  integer not null check (amount_cents >= 0),
  currency      text not null default 'BRL',
  day_of_month  integer not null default 1 check (day_of_month between 1 and 31),
  category      text,
  business_unit text not null default 'clinica',
  method        text,
  active        boolean not null default true,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists fin_recurring_clinic_active_idx on public.fin_recurring(clinic_id, active);

alter table public.fin_recurring enable row level security;
drop policy if exists "Clinic users can view fin recurring" on public.fin_recurring;
create policy "Clinic users can view fin recurring"
  on public.fin_recurring for select to authenticated
  using (public.can_access_clinic(clinic_id));

comment on table public.fin_recurring is
  'Modelos de despesa recorrente (Fase 3). "Gerar contas do mês" materializa em fin_payables. Leitura RLS por clínica; escrita via servidor.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Contas a pagar.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.fin_payables (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics(id) on delete cascade,
  supplier_id   uuid references public.fin_suppliers(id) on delete set null,
  recurring_id  uuid references public.fin_recurring(id) on delete set null,
  description   text not null,
  amount_cents  integer not null check (amount_cents >= 0),
  currency      text not null default 'BRL',
  due_date      date not null default current_date,
  status        text not null default 'open' check (status in ('open','paid','canceled')),
  category      text,
  business_unit text not null default 'clinica',
  method        text,
  paid_at       timestamptz,
  fin_entry_id  uuid references public.fin_entries(id) on delete set null, -- lançamento gerado ao pagar
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists fin_payables_clinic_status_due_idx on public.fin_payables(clinic_id, status, due_date);
-- Dedup da materialização: no máximo 1 conta por recorrente por competência (data de vencimento).
create unique index if not exists fin_payables_recurring_due_uidx
  on public.fin_payables(clinic_id, recurring_id, due_date)
  where recurring_id is not null;

alter table public.fin_payables enable row level security;
drop policy if exists "Clinic users can view fin payables" on public.fin_payables;
create policy "Clinic users can view fin payables"
  on public.fin_payables for select to authenticated
  using (public.can_access_clinic(clinic_id));

comment on table public.fin_payables is
  'Contas a pagar (Fase 3). Ao pagar, gera despesa em fin_entries (source=payable). Leitura RLS por clínica; escrita via servidor (requireFinanceAccess).';
