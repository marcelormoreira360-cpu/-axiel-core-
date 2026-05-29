-- Migration 044: add SOAP + vitals fields to session_records
--
-- These columns exist in production but were never captured in a migration.
-- All ALTER TABLE statements use IF NOT EXISTS — safe to run on production.

ALTER TABLE public.session_records
  ADD COLUMN IF NOT EXISTS soap_mode       boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subjective      text,
  ADD COLUMN IF NOT EXISTS objective       text,
  ADD COLUMN IF NOT EXISTS assessment_note text,
  ADD COLUMN IF NOT EXISTS plan            text,
  ADD COLUMN IF NOT EXISTS vitals          jsonb;

-- Index for filtering records by soap_mode (e.g. prontuário filtering)
CREATE INDEX IF NOT EXISTS idx_session_records_soap_mode
  ON public.session_records (soap_mode)
  WHERE soap_mode = true;

COMMENT ON COLUMN public.session_records.soap_mode       IS 'true = SOAP structured note; false = free-text note';
COMMENT ON COLUMN public.session_records.subjective      IS 'SOAP S: patient-reported symptoms and complaints';
COMMENT ON COLUMN public.session_records.objective       IS 'SOAP O: practitioner observations and measurements';
COMMENT ON COLUMN public.session_records.assessment_note IS 'SOAP A: clinical assessment and diagnosis';
COMMENT ON COLUMN public.session_records.plan            IS 'SOAP P: treatment plan and next steps';
COMMENT ON COLUMN public.session_records.vitals          IS 'Patient-reported vitals: {dor, energia, humor, sono} each 1-5 or null';
