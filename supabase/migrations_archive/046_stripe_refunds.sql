-- ─── Migration 046: Stripe refund fields on patient_payments ─────────────────
--
-- Adds fields needed for Stripe refund tracking:
--   stripe_payment_intent_id — links back to Stripe for refunds
--   status                   — 'paid' | 'refunded' | 'partially_refunded' | 'failed'
--   refunded_at              — when the refund was processed
--   refund_amount_cents      — how much was refunded (for partial refunds)

ALTER TABLE public.patient_payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'paid'
    CHECK (status IN ('paid', 'refunded', 'partially_refunded', 'failed')),
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount_cents integer;

CREATE INDEX IF NOT EXISTS patient_payments_stripe_pi_idx
  ON public.patient_payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- Allow clinic staff to update payment status (refunds)
CREATE POLICY IF NOT EXISTS "clinic_own_payments_update" ON public.patient_payments
  FOR UPDATE USING (clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid()));
