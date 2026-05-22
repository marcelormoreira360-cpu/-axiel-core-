-- ─── Migration 050: zoom_recordings table ─────────────────────────────────────
--
-- Stores Zoom cloud recording metadata received via webhook (recording.completed).
-- Each row = one recording file (MP4, M4A, transcript, etc.) from one meeting.

CREATE TABLE IF NOT EXISTS public.zoom_recordings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id   uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id       uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  zoom_meeting_id  text NOT NULL,
  recording_id     text NOT NULL,
  file_type        text,
  file_size        bigint,
  play_url         text,
  download_url     text,
  recording_start  timestamptz,
  recording_end    timestamptz,
  status           text NOT NULL DEFAULT 'completed',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recording_id)
);

CREATE INDEX IF NOT EXISTS zoom_recordings_clinic_idx     ON public.zoom_recordings(clinic_id);
CREATE INDEX IF NOT EXISTS zoom_recordings_appt_idx       ON public.zoom_recordings(appointment_id);
CREATE INDEX IF NOT EXISTS zoom_recordings_patient_idx    ON public.zoom_recordings(patient_id);
CREATE INDEX IF NOT EXISTS zoom_recordings_meeting_idx    ON public.zoom_recordings(zoom_meeting_id);

ALTER TABLE public.zoom_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zoom_recordings_select ON public.zoom_recordings;
CREATE POLICY zoom_recordings_select ON public.zoom_recordings
  FOR SELECT USING (clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid()));
