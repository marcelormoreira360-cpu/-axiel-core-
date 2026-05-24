-- ============================================================
-- Migration 018 — Patient recurring subscriptions
--
-- Tracks per-patient monthly plans sold through Stripe.
-- Separate from the clinic's own AXIEL plan (public.subscriptions).
-- ============================================================

-- Add billing_interval to monetization_offers for membership-type offers
alter table public.monetization_offers
  add column if not exists billing_interval text
    check (billing_interval in ('monthly', 'yearly'))
    default 'monthly';

-- ── patient_subscriptions ─────────────────────────────────────────────────────

create table if not exists public.patient_subscriptions (
  id                        uuid        primary key default gen_random_uuid(),
  clinic_id                 uuid        not null references public.clinics(id) on delete cascade,
  patient_id                uuid        not null references public.patients(id) on delete cascade,
  offer_id                  uuid        references public.monetization_offers(id) on delete set null,

  -- Stripe identifiers
  stripe_subscription_id    text        unique,
  stripe_customer_id        text,
  stripe_price_id           text,

  -- Plan snapshot (captured at purchase time)
  plan_name                 text        not null,
  amount_cents              integer     not null check (amount_cents >= 0),
  currency                  text        not null default 'BRL',
  billing_interval          text        not null default 'monthly'
                              check (billing_interval in ('monthly', 'yearly')),
  sessions_per_cycle        integer     not null default 0 check (sessions_per_cycle >= 0),
  sessions_used_this_cycle  integer     not null default 0 check (sessions_used_this_cycle >= 0),

  -- Status mirrors Stripe subscription statuses
  status                    text        not null default 'incomplete'
                              check (status in ('trialing','active','past_due','canceled','unpaid','incomplete','paused')),

  current_period_start      timestamptz,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean     not null default false,
  canceled_at               timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists patient_subscriptions_clinic_idx
  on public.patient_subscriptions (clinic_id);

create index if not exists patient_subscriptions_patient_idx
  on public.patient_subscriptions (patient_id);

create index if not exists patient_subscriptions_stripe_idx
  on public.patient_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists patient_subscriptions_status_idx
  on public.patient_subscriptions (clinic_id, status);

alter table public.patient_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'patient_subscriptions'
      and policyname = 'Clinic members manage patient subscriptions'
  ) then
    execute $policy$
      create policy "Clinic members manage patient subscriptions"
        on public.patient_subscriptions
        for all
        using (
          clinic_id in (
            select clinic_id from public.clinic_users
            where user_id = auth.uid() and status = 'active'
          )
        )
        with check (
          clinic_id in (
            select clinic_id from public.clinic_users
            where user_id = auth.uid() and status = 'active'
          )
        )
    $policy$;
  end if;
end $$;
