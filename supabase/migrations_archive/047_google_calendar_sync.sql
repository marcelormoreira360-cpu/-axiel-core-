-- ─── Migration 047: Google Calendar incremental sync fields ──────────────────
--
-- Adds sync_token (Google incremental sync) and last_synced_at to
-- calendar_integrations so we can do efficient delta syncs instead of
-- re-fetching the full calendar every time.

ALTER TABLE public.calendar_integrations
  ADD COLUMN IF NOT EXISTS sync_token    text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
