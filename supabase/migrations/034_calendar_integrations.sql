-- ── 034: Calendar & Zoom integrations ────────────────────────────────────────
-- Adds calendar_integrations and zoom_integrations tables, enriches appointments
-- with meeting/calendar fields, and adds ical_secret to clinics.

-- 1. calendar_integrations — stores OAuth tokens for Google Calendar (and future providers)
CREATE TABLE IF NOT EXISTS public.calendar_integrations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  provider         text        NOT NULL CHECK (provider IN ('google')),
  access_token     text        NOT NULL,
  refresh_token    text,
  token_expires_at timestamptz,
  calendar_id      text        NOT NULL DEFAULT 'primary',
  connected_at     timestamptz NOT NULL DEFAULT now(),
  connected_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE(clinic_id, provider)
);

-- 2. zoom_integrations — stores OAuth tokens for Zoom per clinic
CREATE TABLE IF NOT EXISTS public.zoom_integrations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        uuid        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  access_token     text        NOT NULL,
  refresh_token    text,
  token_expires_at timestamptz,
  zoom_user_id     text,
  zoom_user_email  text,
  connected_at     timestamptz NOT NULL DEFAULT now(),
  connected_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE(clinic_id)
);

-- 3. Enrich appointments with meeting/calendar reference fields
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS zoom_meeting_id  text,
  ADD COLUMN IF NOT EXISTS zoom_join_url    text,
  ADD COLUMN IF NOT EXISTS zoom_start_url   text,
  ADD COLUMN IF NOT EXISTS google_event_id  text,
  ADD COLUMN IF NOT EXISTS ical_uid         text DEFAULT gen_random_uuid()::text;

-- 4. Add per-clinic iCal feed secret (used to authenticate public iCal URLs)
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS ical_secret text DEFAULT encode(gen_random_bytes(24), 'hex');

-- 5. Indexes
CREATE INDEX IF NOT EXISTS calendar_integrations_clinic_id_idx ON public.calendar_integrations(clinic_id);
CREATE INDEX IF NOT EXISTS zoom_integrations_clinic_id_idx     ON public.zoom_integrations(clinic_id);

-- 6. Row Level Security ──────────────────────────────────────────────────────

-- calendar_integrations
ALTER TABLE public.calendar_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_integrations_select" ON public.calendar_integrations;
DROP POLICY IF EXISTS "calendar_integrations_insert" ON public.calendar_integrations;
DROP POLICY IF EXISTS "calendar_integrations_update" ON public.calendar_integrations;
DROP POLICY IF EXISTS "calendar_integrations_delete" ON public.calendar_integrations;

CREATE POLICY "calendar_integrations_select" ON public.calendar_integrations
  FOR SELECT
  USING (public.can_access_clinic(clinic_id));

CREATE POLICY "calendar_integrations_insert" ON public.calendar_integrations
  FOR INSERT
  WITH CHECK (public.can_manage_clinic(clinic_id));

CREATE POLICY "calendar_integrations_update" ON public.calendar_integrations
  FOR UPDATE
  USING (public.can_manage_clinic(clinic_id));

CREATE POLICY "calendar_integrations_delete" ON public.calendar_integrations
  FOR DELETE
  USING (public.can_manage_clinic(clinic_id));

-- zoom_integrations
ALTER TABLE public.zoom_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zoom_integrations_select" ON public.zoom_integrations;
DROP POLICY IF EXISTS "zoom_integrations_insert" ON public.zoom_integrations;
DROP POLICY IF EXISTS "zoom_integrations_update" ON public.zoom_integrations;
DROP POLICY IF EXISTS "zoom_integrations_delete" ON public.zoom_integrations;

CREATE POLICY "zoom_integrations_select" ON public.zoom_integrations
  FOR SELECT
  USING (public.can_access_clinic(clinic_id));

CREATE POLICY "zoom_integrations_insert" ON public.zoom_integrations
  FOR INSERT
  WITH CHECK (public.can_manage_clinic(clinic_id));

CREATE POLICY "zoom_integrations_update" ON public.zoom_integrations
  FOR UPDATE
  USING (public.can_manage_clinic(clinic_id));

CREATE POLICY "zoom_integrations_delete" ON public.zoom_integrations
  FOR DELETE
  USING (public.can_manage_clinic(clinic_id));
