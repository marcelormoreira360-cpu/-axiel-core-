-- PERF-01: Add generated column sessions_remaining to patient_packages.
-- This allows the cron job to filter low-session packages entirely in SQL
-- instead of fetching the full table and filtering in JavaScript.

-- Ensure sessions_used exists before creating the generated column that references it
alter table public.patient_packages
  add column if not exists sessions_used integer not null default 0;

alter table public.patient_packages
  add column if not exists sessions_remaining integer
    generated always as (greatest(sessions_total - sessions_used, 0)) stored;

-- Index to make the cron query fast: active packages with low sessions remaining
create index if not exists patient_packages_low_sessions_idx
  on public.patient_packages (sessions_remaining)
  where is_active = true;
