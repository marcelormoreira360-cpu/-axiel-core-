-- Finance AI insights cache
-- Stores generated financial analysis results keyed by clinic + period,
-- so repeated requests within the 6-hour TTL skip the OpenAI call.

create table if not exists finance_insights (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references clinics(id) on delete cascade,
  period_month   text not null,            -- e.g. "2025-05"
  content        jsonb not null,           -- FinanceAIInsight body (sans timestamps)
  generated_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index if not exists finance_insights_clinic_generated
  on finance_insights (clinic_id, generated_at desc);

-- RLS: only the owning clinic can read / write
alter table finance_insights enable row level security;

create policy "clinic members can select their insights"
  on finance_insights for select
  using (
    clinic_id in (
      select clinic_id from clinic_users where user_id = auth.uid()
    )
  );

create policy "clinic members can insert insights"
  on finance_insights for insert
  with check (
    clinic_id in (
      select clinic_id from clinic_users where user_id = auth.uid()
    )
  );

-- Service-role (used by admin client in generateFinanceInsight) bypasses RLS automatically.
