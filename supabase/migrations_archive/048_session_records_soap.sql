-- ─── Migration 048: SOAP fields + vitals on session_records ──────────────────
--
-- The session recording UI supports two modes: "livre" (free notes) and
-- "soap" (Subjective / Objective / Assessment / Plan). It also captures
-- vitals (pain, energy, mood, sleep on a 1–5 scale).
-- These columns were missing from the initial schema, causing SOAP data
-- to be silently discarded on save.

ALTER TABLE public.session_records
  ADD COLUMN IF NOT EXISTS soap_mode       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subjective      text,
  ADD COLUMN IF NOT EXISTS objective       text,
  ADD COLUMN IF NOT EXISTS assessment_note text,
  ADD COLUMN IF NOT EXISTS plan            text,
  ADD COLUMN IF NOT EXISTS vitals          jsonb;
