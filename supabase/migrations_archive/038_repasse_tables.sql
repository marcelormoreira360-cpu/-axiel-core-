-- Repasse (collaborator revenue-sharing) tables
-- repasse_rules: percentage rules per professional per clinic
-- repasse_ledger: monthly calculated entries with paid/pending status

-- ── Rules ──────────────────────────────────────────────────────────

create table if not exists repasse_rules (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references clinics(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  percentage   numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create index if not exists repasse_rules_clinic on repasse_rules (clinic_id);

alter table repasse_rules enable row level security;

create policy "clinic members can manage repasse rules"
  on repasse_rules for all
  using (
    clinic_id in (
      select clinic_id from clinic_users where user_id = auth.uid()
    )
  )
  with check (
    clinic_id in (
      select clinic_id from clinic_users where user_id = auth.uid()
    )
  );

-- ── Ledger ─────────────────────────────────────────────────────────

create table if not exists repasse_ledger (
  id                   uuid primary key default gen_random_uuid(),
  clinic_id            uuid not null references clinics(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  period_month         text not null,                 -- "YYYY-MM"
  sessions_count       integer not null default 0,
  gross_revenue_cents  integer not null default 0,
  repasse_cents        integer not null default 0,
  status               text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at              timestamptz,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (clinic_id, user_id, period_month)
);

create index if not exists repasse_ledger_clinic_month
  on repasse_ledger (clinic_id, period_month desc);

alter table repasse_ledger enable row level security;

create policy "clinic members can manage repasse ledger"
  on repasse_ledger for all
  using (
    clinic_id in (
      select clinic_id from clinic_users where user_id = auth.uid()
    )
  )
  with check (
    clinic_id in (
      select clinic_id from clinic_users where user_id = auth.uid()
    )
  );
