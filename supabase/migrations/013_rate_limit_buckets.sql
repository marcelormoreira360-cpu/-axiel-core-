-- Migration 013: distributed rate-limit buckets (M-08)
-- Replaces the in-process Map-based rate limiter with a Supabase-backed
-- atomic counter so all Vercel instances share the same window counts.

-- Table: one row per (key, window_start) pair
create table if not exists public.rate_limit_buckets (
  key          text        not null,
  window_start timestamptz not null,
  count        int         not null default 1,
  primary key  (key, window_start)
);

-- Keep the table small: auto-delete buckets older than 1 hour via cron or
-- opportunistic cleanup inside the function below.

-- Atomic upsert function: increments the bucket and returns TRUE if allowed.
-- Buckets older than the current window are cleaned up on each call.
create or replace function public.check_rate_limit(
  p_key          text,
  p_window_start timestamptz,
  p_max_requests int
) returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count int;
begin
  -- Opportunistic cleanup of stale buckets for this key (keeps table lean)
  delete from public.rate_limit_buckets
  where key = p_key
    and window_start < p_window_start;

  -- Atomic increment (insert or update)
  insert into public.rate_limit_buckets (key, window_start, count)
    values (p_key, p_window_start, 1)
  on conflict (key, window_start) do update
    set count = rate_limit_buckets.count + 1
  returning count into v_count;

  return v_count <= p_max_requests;
end;
$$;

-- No direct RLS needed — only the service role (admin client) calls this function.
alter table public.rate_limit_buckets enable row level security;
create policy "service role only" on public.rate_limit_buckets
  using (false);  -- block all direct table access; function runs as security definer
