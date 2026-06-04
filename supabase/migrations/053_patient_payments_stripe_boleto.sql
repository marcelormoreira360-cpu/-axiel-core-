-- migration 053_patient_payments_stripe_boleto.sql
-- Fase 1 (recebimento de pacientes) — correções de produção:
--   (a) garantir colunas Stripe/refund em patient_payments (faltavam em prod);
--   (b) incluir 'boleto' no CHECK de payment_method;
--   (c) índice ÚNICO parcial em stripe_payment_intent_id (idempotência do webhook).
-- Idempotente — seguro rodar mais de uma vez.

-- 1. Colunas usadas pelo webhook do Stripe (podem não existir em produção) ───────
alter table public.patient_payments
  add column if not exists stripe_payment_intent_id text,
  add column if not exists refunded_at              timestamptz,
  add column if not exists refund_amount_cents      integer,
  add column if not exists status                   text not null default 'paid';

-- 2. payment_method: incluir 'boleto' (mantendo os demais) ───────────────────────
alter table public.patient_payments
  drop constraint if exists patient_payments_payment_method_check;
alter table public.patient_payments
  add constraint patient_payments_payment_method_check
  check (payment_method in (
    'pix','boleto','credit_card','debit_card','cash','transfer','insurance','other'
  ));

-- 3. status: garantir o CHECK (idempotente) ──────────────────────────────────────
alter table public.patient_payments
  drop constraint if exists patient_payments_status_check;
alter table public.patient_payments
  add constraint patient_payments_status_check
  check (status in ('paid','refunded','partially_refunded','failed'));

-- 4. Índice ÚNICO parcial — evita pagamento duplicado em reentrega de evento ──────
drop index if exists patient_payments_stripe_pi_idx;
create unique index if not exists patient_payments_stripe_pi_uidx
  on public.patient_payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- 5. Recarrega o schema cache do PostgREST ────────────────────────────────────────
notify pgrst, 'reload schema';
