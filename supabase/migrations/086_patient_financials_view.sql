-- 086_patient_financials_view.sql
-- View de rollup financeiro POR PACIENTE (receita, ticket, LTV, planos).
-- Sem tabela mantida: deriva de patient_payments + patient_offers.
-- security_invoker=on → a RLS de clínica das tabelas-base é aplicada para o
-- usuário que consulta (escopo por clínica preservado, sem security_definer_view).
-- ⚠️ A camada de app ainda deve restringir o acesso a gestores (finance access).

create or replace view public.patient_financials
with (security_invoker = on) as
with pay as (
  select
    patient_id,
    clinic_id,
    coalesce(sum(amount_cents) filter (where status = 'paid'), 0)     as total_revenue_cents,
    count(*)                   filter (where status = 'paid')         as payments_count,
    min(paid_at)               filter (where status = 'paid')         as first_payment_at,
    max(paid_at)               filter (where status = 'paid')         as last_payment_at,
    coalesce(sum(amount_cents) filter (where status = 'pending'), 0)  as pending_cents,
    coalesce(sum(coalesce(refund_amount_cents, amount_cents))
             filter (where status = 'refunded'), 0)                   as refunded_cents
  from public.patient_payments
  group by patient_id, clinic_id
),
off as (
  select
    patient_id,
    clinic_id,
    count(*)                                                          as plans_offered,
    count(*) filter (where status::text in ('active', 'completed'))   as plans_accepted
  from public.patient_offers
  where deleted_at is null
  group by patient_id, clinic_id
)
select
  coalesce(pay.patient_id, off.patient_id)              as patient_id,
  coalesce(pay.clinic_id,  off.clinic_id)               as clinic_id,
  coalesce(pay.total_revenue_cents, 0)                  as total_revenue_cents,
  coalesce(pay.payments_count, 0)                       as payments_count,
  case when coalesce(pay.payments_count, 0) > 0
       then round(pay.total_revenue_cents::numeric / pay.payments_count)::int
       else 0 end                                       as average_ticket_cents,
  coalesce(pay.total_revenue_cents, 0)                  as lifetime_value_cents,
  pay.first_payment_at,
  pay.last_payment_at,
  coalesce(pay.pending_cents, 0)                        as pending_cents,
  coalesce(pay.refunded_cents, 0)                       as refunded_cents,
  coalesce(off.plans_offered, 0)                        as plans_offered,
  coalesce(off.plans_accepted, 0)                       as plans_accepted
from pay
full outer join off
  on pay.patient_id = off.patient_id and pay.clinic_id = off.clinic_id;

revoke all on public.patient_financials from anon;
grant select on public.patient_financials to authenticated, service_role;

comment on view public.patient_financials is
  'Rollup financeiro por paciente (receita/ticket/LTV/planos). security_invoker=on: RLS de clinica das tabelas-base aplica. App deve restringir exposicao a gestores.';
