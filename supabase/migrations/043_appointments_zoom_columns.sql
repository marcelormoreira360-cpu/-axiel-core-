-- Migration 043: add missing appointment columns that exist in production but lack migrations
--
-- These columns were added manually to the live DB at some point.
-- This migration makes the schema reproducible for fresh installs and local dev.
-- All ALTER TABLE statements use IF NOT EXISTS — safe to run on production.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS session_type_id  uuid        REFERENCES public.session_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source           text        NOT NULL DEFAULT 'clinic',
  ADD COLUMN IF NOT EXISTS zoom_meeting_id  text,
  ADD COLUMN IF NOT EXISTS zoom_join_url    text,
  ADD COLUMN IF NOT EXISTS zoom_start_url   text,
  ADD COLUMN IF NOT EXISTS google_event_id  text;

-- Partial index: quickly find online appointments that have a Zoom meeting
CREATE INDEX IF NOT EXISTS idx_appointments_zoom_meeting_id
  ON public.appointments (zoom_meeting_id)
  WHERE zoom_meeting_id IS NOT NULL;
