-- Migration 046: patient push subscriptions
--
-- Allows patients to receive Web Push notifications on their devices
-- from the patient portal. Separate table from push_subscriptions (staff)
-- because patients are not Supabase Auth users.

CREATE TABLE IF NOT EXISTS public.patient_push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id    uuid NOT NULL,
  endpoint     text NOT NULL,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_patient_push_subs_patient
  ON public.patient_push_subscriptions(patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_push_subs_clinic
  ON public.patient_push_subscriptions(clinic_id);

COMMENT ON TABLE public.patient_push_subscriptions IS
  'Web Push subscriptions for patients (portal access — no Supabase Auth)';
