-- migration 061_asaas_pix_fields.sql
-- Plano B Pix via Asaas: campos para cliente Asaas e idempotência de cobrança.
-- Idempotente, additivo.

alter table public.patients
  add column if not exists cpf               text,
  add column if not exists asaas_customer_id text;

alter table public.patient_payments
  add column if not exists asaas_payment_id text;

-- idempotência do webhook do Asaas (igual ao stripe_payment_intent_id)
create unique index if not exists patient_payments_asaas_id_uidx
  on public.patient_payments(asaas_payment_id)
  where asaas_payment_id is not null;

notify pgrst, 'reload schema';
