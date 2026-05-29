-- Migration 045: LGPD compliance — consent records + data deletion requests
--
-- Implements two LGPD rights:
--   1. Right to consent tracking: record what data processing was consented to and when
--   2. Right to erasure: patients can request deletion of their data

-- ── Patient consents ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_consents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid        NOT NULL REFERENCES public.clinics(id)   ON DELETE CASCADE,
  patient_id    uuid        NOT NULL REFERENCES public.patients(id)  ON DELETE CASCADE,
  consent_type  text        NOT NULL, -- 'data_processing' | 'marketing' | 'sharing' | 'portal_access'
  granted       boolean     NOT NULL DEFAULT true,
  ip_address    text,
  user_agent    text,
  source        text        NOT NULL DEFAULT 'portal', -- 'portal' | 'onboarding' | 'manual'
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_consents_patient_id
  ON public.patient_consents (patient_id, consent_type, created_at DESC);

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic staff can read their consents"
  ON public.patient_consents FOR SELECT
  USING (clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()));

CREATE POLICY "service role full access on patient_consents"
  ON public.patient_consents FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── Data deletion requests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid        NOT NULL REFERENCES public.clinics(id)   ON DELETE CASCADE,
  patient_id    uuid        NOT NULL REFERENCES public.patients(id)  ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_review', 'completed', 'rejected')),
  reason        text,
  requested_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_clinic_status
  ON public.data_deletion_requests (clinic_id, status, requested_at DESC);

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic staff can manage deletion requests"
  ON public.data_deletion_requests FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.clinic_users WHERE user_id = auth.uid()));

CREATE POLICY "service role full access on data_deletion_requests"
  ON public.data_deletion_requests FOR ALL
  USING (true)
  WITH CHECK (true);
