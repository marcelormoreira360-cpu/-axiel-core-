-- ── 032: Business Intelligence schema ──────────────────────────────────────
-- Adds pricing to session_types, enriches appointments with type/source/offer,
-- and creates patient_payments for revenue tracking.

-- 1. price_cents on session_types
ALTER TABLE public.session_types
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0
    CHECK (price_cents >= 0);

-- 2. Enrich appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS session_type_id uuid REFERENCES public.session_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text CHECK (source IN ('website','instagram','facebook','google','referral','direct','package','other')),
  ADD COLUMN IF NOT EXISTS patient_offer_id uuid REFERENCES public.patient_offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_session_type_id_idx ON public.appointments(session_type_id);
CREATE INDEX IF NOT EXISTS appointments_source_idx ON public.appointments(source);

-- 3. patient_payments — tracks revenue per session or package sale
CREATE TABLE IF NOT EXISTS public.patient_payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id     uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_offer_id uuid REFERENCES public.patient_offers(id) ON DELETE SET NULL,
  amount_cents   integer NOT NULL CHECK (amount_cents >= 0),
  currency       text NOT NULL DEFAULT 'BRL',
  payment_method text CHECK (payment_method IN ('pix','credit_card','debit_card','cash','transfer','insurance','other')),
  paid_at        timestamptz NOT NULL DEFAULT now(),
  notes          text,
  created_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patient_payments_clinic_id_idx  ON public.patient_payments(clinic_id);
CREATE INDEX IF NOT EXISTS patient_payments_patient_id_idx ON public.patient_payments(patient_id);
CREATE INDEX IF NOT EXISTS patient_payments_paid_at_idx    ON public.patient_payments(paid_at);

ALTER TABLE public.patient_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_own_payments_select" ON public.patient_payments
  FOR SELECT USING (clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "clinic_own_payments_insert" ON public.patient_payments
  FOR INSERT WITH CHECK (clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "clinic_own_payments_update" ON public.patient_payments
  FOR UPDATE USING (clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "clinic_own_payments_delete" ON public.patient_payments
  FOR DELETE USING (clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid()));
