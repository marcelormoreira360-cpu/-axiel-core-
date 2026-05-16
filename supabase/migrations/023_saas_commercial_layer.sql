-- AXIEL Core — SaaS Commercial Layer
-- Billing is a commercial SaaS layer, separate from the patient journey.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price_cents integer,
  billing_interval text not null default 'month',
  max_users integer,
  max_patients integer,
  max_forms integer,
  max_ai_insights integer,
  max_locations integer,
  features jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint plans_slug_check check (slug in ('starter', 'professional', 'enterprise')),
  constraint plans_billing_interval_check check (billing_interval in ('month', 'year', 'custom'))
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  plan_id uuid references public.plans(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscriptions_clinic_unique unique (clinic_id),
  constraint subscriptions_status_check check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete')
  )
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  stripe_event_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  event_type text not null,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  feature_key text not null,
  is_enabled boolean not null default false,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint feature_flags_unique unique (clinic_id, feature_key),
  constraint feature_flags_source_check check (source in ('plan', 'manual', 'enterprise', 'trial'))
);

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.usage_events enable row level security;
alter table public.feature_flags enable row level security;

drop policy if exists "plans are readable by authenticated users" on public.plans;
create policy "plans are readable by authenticated users"
on public.plans for select
to authenticated
using (is_active = true);

drop policy if exists "subscriptions are readable by clinic users" on public.subscriptions;
create policy "subscriptions are readable by clinic users"
on public.subscriptions for select
to authenticated
using (public.can_access_clinic(clinic_id));

drop policy if exists "subscriptions are manageable by clinic owners" on public.subscriptions;
create policy "subscriptions are manageable by clinic owners"
on public.subscriptions for all
to authenticated
using (public.can_manage_clinic(clinic_id))
with check (public.can_manage_clinic(clinic_id));

drop policy if exists "billing events are readable by clinic managers" on public.billing_events;
create policy "billing events are readable by clinic managers"
on public.billing_events for select
to authenticated
using (clinic_id is not null and public.can_manage_clinic(clinic_id));

drop policy if exists "usage events are readable by clinic users" on public.usage_events;
create policy "usage events are readable by clinic users"
on public.usage_events for select
to authenticated
using (public.can_access_clinic(clinic_id));

drop policy if exists "usage events are writable by clinic users" on public.usage_events;
create policy "usage events are writable by clinic users"
on public.usage_events for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

drop policy if exists "feature flags are readable by clinic users" on public.feature_flags;
create policy "feature flags are readable by clinic users"
on public.feature_flags for select
to authenticated
using (public.can_access_clinic(clinic_id));

drop policy if exists "feature flags are manageable by clinic owners" on public.feature_flags;
create policy "feature flags are manageable by clinic owners"
on public.feature_flags for all
to authenticated
using (public.can_manage_clinic(clinic_id))
with check (public.can_manage_clinic(clinic_id));

insert into public.plans (
  name,
  slug,
  description,
  price_cents,
  billing_interval,
  max_users,
  max_patients,
  max_forms,
  max_ai_insights,
  max_locations,
  features,
  limits,
  is_active
)
values
(
  'Starter',
  'starter',
  'For one clinic getting organized.',
  4900,
  'month',
  3,
  250,
  10,
  0,
  1,
  '{"leads":true,"schedule":true,"forms":true,"ai_insights":false,"patient_snapshot":true,"patient_portal":false,"product_support":false,"membership":false,"multi_clinic":false,"advanced_permissions":false,"stripe_checkout":false}'::jsonb,
  '{"users":3,"patients":250,"forms":10,"ai_insights":0,"locations":1}'::jsonb,
  true
),
(
  'Professional',
  'professional',
  'For clinics ready to run the full AXIEL workflow.',
  14900,
  'month',
  10,
  2500,
  50,
  500,
  1,
  '{"leads":true,"schedule":true,"forms":true,"ai_insights":true,"patient_snapshot":true,"patient_portal":true,"product_support":true,"membership":true,"multi_clinic":false,"advanced_permissions":false,"stripe_checkout":true}'::jsonb,
  '{"users":10,"patients":2500,"forms":50,"ai_insights":500,"locations":1}'::jsonb,
  true
),
(
  'Enterprise',
  'enterprise',
  'For multi-location clinics and advanced operations.',
  null,
  'custom',
  null,
  null,
  null,
  null,
  null,
  '{"leads":true,"schedule":true,"forms":true,"ai_insights":true,"patient_snapshot":true,"patient_portal":true,"product_support":true,"membership":true,"multi_clinic":true,"advanced_permissions":true,"stripe_checkout":true}'::jsonb,
  '{"users":null,"patients":null,"forms":null,"ai_insights":null,"locations":null}'::jsonb,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  billing_interval = excluded.billing_interval,
  max_users = excluded.max_users,
  max_patients = excluded.max_patients,
  max_forms = excluded.max_forms,
  max_ai_insights = excluded.max_ai_insights,
  max_locations = excluded.max_locations,
  features = excluded.features,
  limits = excluded.limits,
  is_active = excluded.is_active,
  updated_at = now();
