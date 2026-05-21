-- AXIEL Core - Stripe subscription billing
-- Adds Stripe identifiers, trial settings, billing events, and simple SaaS plans.

alter table public.plans
  add column if not exists stripe_price_id text,
  add column if not exists trial_days integer not null default 14 check (trial_days >= 0 and trial_days <= 90),
  add column if not exists sort_order integer not null default 100;

alter table public.subscriptions
  add column if not exists stripe_checkout_session_id text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz;

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  external_subscription_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_events_clinic_id_idx on public.billing_events(clinic_id);
create index if not exists billing_events_event_type_idx on public.billing_events(event_type);
create index if not exists billing_events_created_at_idx on public.billing_events(created_at desc);

alter table public.billing_events enable row level security;

drop policy if exists "Clinic owners can view billing events" on public.billing_events;
create policy "Clinic owners can view billing events"
on public.billing_events for select to authenticated
using (public.can_manage_clinic(clinic_id) or public.is_admin());

-- Lock billing writes to service role/admin-style operations. Normal app users do not insert webhook rows.
revoke insert, update, delete on public.billing_events from authenticated;

update public.plans
set
  name = 'Starter',
  description = 'Simple operations for one clinic.',
  price_cents = 4900,
  currency = 'USD',
  billing_interval = 'monthly',
  max_users = 2,
  max_patients = 250,
  ai_insights_included = 0,
  features = '{"clinics": 1, "crm": true, "schedule": true, "intake": true}'::jsonb,
  trial_days = 14,
  sort_order = 1
where code = 'starter';

update public.plans
set
  name = 'Professional',
  description = 'Full clinic workflow with reports and AI-ready structure.',
  price_cents = 14900,
  currency = 'USD',
  billing_interval = 'monthly',
  max_users = null,
  max_patients = 2500,
  ai_insights_included = 100,
  features = '{"clinics": 1, "crm": true, "schedule": true, "intake": true, "reports": true, "ai_insights": true}'::jsonb,
  trial_days = 14,
  sort_order = 2
where code = 'professional';

update public.plans
set
  name = 'Enterprise',
  description = 'Custom limits, advanced controls, and scale support.',
  price_cents = 0,
  currency = 'USD',
  billing_interval = 'monthly',
  max_users = null,
  max_patients = null,
  ai_insights_included = null,
  features = '{"clinics": "custom", "custom_branding": true, "audit_logs": true, "feature_flags": true, "priority_support": true}'::jsonb,
  trial_days = 0,
  sort_order = 3
where code = 'enterprise';

insert into public.feature_flags (clinic_id, flag_key, is_enabled, description)
select s.clinic_id, 'billing_enabled', true, 'Stripe Billing is available for this clinic.'
from public.subscriptions s
on conflict do nothing;
