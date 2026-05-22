-- ─── Migration 051: is_recorded field on session_types ────────────────────────
--
-- Controls whether Zoom cloud recording is enabled per session type.
-- Only relevant when is_online = true.
-- Defaults to true so existing online sessions keep recording.

ALTER TABLE public.session_types
  ADD COLUMN IF NOT EXISTS is_recorded boolean NOT NULL DEFAULT true;
