-- migration 062_asaas_subscription_id.sql
-- Mensalidade recorrente via Asaas: id da assinatura Asaas em patient_subscriptions.
alter table public.patient_subscriptions
  add column if not exists asaas_subscription_id text;

create unique index if not exists patient_subscriptions_asaas_id_uidx
  on public.patient_subscriptions(asaas_subscription_id)
  where asaas_subscription_id is not null;

notify pgrst, 'reload schema';
