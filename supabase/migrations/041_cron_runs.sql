-- Migration 041: cron_runs — observability and idempotency for scheduled jobs
--
-- Records every cron execution with status, duration and result payload.
-- The cron-guard helper uses this table to prevent double-runs when a job
-- succeeds on the first attempt and a retry fires shortly after.

create table if not exists public.cron_runs (
  id            uuid        primary key default gen_random_uuid(),
  job_name      text        not null,
  status        text        not null
                  check (status in ('running', 'success', 'error')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  duration_ms   integer,
  result        jsonb,
  error_message text
);

-- Fast lookup: "did this job succeed recently?"
create index if not exists idx_cron_runs_job_started
  on public.cron_runs (job_name, started_at desc);

-- Auto-purge rows older than 90 days so the table stays small.
-- Run as a separate cron or call manually; not enforced at insert time.
-- Uncomment if pg_cron is available on the Supabase plan:
-- SELECT cron.schedule('purge-cron-runs', '0 3 * * 0',
--   $$ DELETE FROM public.cron_runs WHERE started_at < now() - interval '90 days' $$);

-- RLS: cron routes use the service-role key, so no policy needed.
-- Dashboard admins can query directly via the Supabase Studio table view.
alter table public.cron_runs enable row level security;
