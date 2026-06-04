-- migration 054_patient_payments_pending_proof.sql
-- Fase 3 (conciliação manual: Zelle / transferência / dinheiro):
--   (a) status 'pending' (aguardando confirmação) em patient_payments;
--   (b) proof_path  — caminho do comprovante no storage (bucket patient-docs);
--   (c) confirmed_at — quando um pendente foi confirmado como recebido.
-- Idempotente.

alter table public.patient_payments
  add column if not exists proof_path   text,
  add column if not exists confirmed_at timestamptz;

alter table public.patient_payments
  drop constraint if exists patient_payments_status_check;
alter table public.patient_payments
  add constraint patient_payments_status_check
  check (status in ('pending','paid','refunded','partially_refunded','failed'));

notify pgrst, 'reload schema';
