-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008 — Billing & DB fixes
--
-- BILL-02: reconcile billing_interval constraint across environments
--          (001 uses 'monthly'/'yearly'; 007 incorrectly used 'month'/'year')
-- DB-03:   tighten patient_packages DELETE policy to can_manage_clinic
-- DB-04:   add index on patient_payments.stripe_payment_intent_id
-- ─────────────────────────────────────────────────────────────────────────────


-- ── BILL-02: normalize billing_interval values and unify the constraint ───────

-- Normalise any rows that may have been inserted with the old short forms
update public.plans set billing_interval = 'monthly' where billing_interval = 'month';
update public.plans set billing_interval = 'yearly'  where billing_interval = 'year';

-- Drop old constraint (name may differ between environments; try both)
alter table public.plans
  drop constraint if exists plans_billing_interval_check;

-- Re-add a unified constraint that accepts both canonical values
alter table public.plans
  add constraint plans_billing_interval_check
  check (billing_interval in ('monthly', 'yearly', 'custom'));


-- ── DB-03: tighten patient_packages DELETE policy ─────────────────────────────
-- Previously used can_write_clinic_data (any staff) — should require manager+

drop policy if exists "patient_packages_delete" on public.patient_packages;
create policy "patient_packages_delete" on public.patient_packages
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));


-- ── DB-04: index on stripe_payment_intent_id ─────────────────────────────────
-- Webhook handler queries patient_payments by this column on every charge event

create index if not exists patient_payments_stripe_pi_idx
  on public.patient_payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
