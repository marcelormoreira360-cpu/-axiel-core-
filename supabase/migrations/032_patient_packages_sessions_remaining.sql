-- PERF-01: Add generated column sessions_remaining to patient_packages.
-- This allows the cron job to filter low-session packages entirely in SQL
-- instead of fetching the full table and filtering in JavaScript.

alter table public.patient_packages
  add column if not exists sessions_remaining integer
    generated always as (greatest(sessions_total - sessions_used, 0)) stored;

-- Index to make the cron query fast: active packages with low sessions remaining
create index if not exists patient_packages_low_sessions_idx
  on public.patient_packages (sessions_remaining)
  where is_active = true;
