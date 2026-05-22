-- ─── Migration 049: hotmart_purchases table ───────────────────────────────────
--
-- Stores all Hotmart webhook events (purchases, cancellations, refunds).
-- Each row represents one Hotmart transaction event.

CREATE TABLE IF NOT EXISTS public.hotmart_purchases (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id     uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  transaction_id text NOT NULL,
  product_id     text,
  product_name   text,
  offer_code     text,
  buyer_email    text NOT NULL,
  buyer_name     text,
  buyer_phone    text,
  status         text NOT NULL DEFAULT 'other'
    CHECK (status IN ('completed','cancelled','refunded','chargeback','other')),
  price_cents    integer,
  currency       text NOT NULL DEFAULT 'BRL',
  event_type     text,
  payload        jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id)
);

CREATE INDEX IF NOT EXISTS hotmart_purchases_clinic_idx   ON public.hotmart_purchases(clinic_id);
CREATE INDEX IF NOT EXISTS hotmart_purchases_patient_idx  ON public.hotmart_purchases(patient_id);
CREATE INDEX IF NOT EXISTS hotmart_purchases_status_idx   ON public.hotmart_purchases(status);
CREATE INDEX IF NOT EXISTS hotmart_purchases_created_idx  ON public.hotmart_purchases(created_at DESC);

ALTER TABLE public.hotmart_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotmart_purchases_select ON public.hotmart_purchases;
DROP POLICY IF EXISTS hotmart_purchases_insert ON public.hotmart_purchases;
DROP POLICY IF EXISTS hotmart_purchases_update ON public.hotmart_purchases;

CREATE POLICY hotmart_purchases_select ON public.hotmart_purchases
  FOR SELECT USING (clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY hotmart_purchases_insert ON public.hotmart_purchases
  FOR INSERT WITH CHECK (clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY hotmart_purchases_update ON public.hotmart_purchases
  FOR UPDATE USING (clinic_id = (SELECT clinic_id FROM public.users WHERE id = auth.uid()));
