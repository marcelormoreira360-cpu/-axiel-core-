-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007 — Pricing v2
--
-- • Creates the `plans` table if it doesn't exist
-- • Adds multi-currency columns (price_usd_cents, price_eur_cents)
-- • Adds `recommended` flag
-- • Upserts all 4 canonical plans: starter, professional, scale, enterprise
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Create plans table ─────────────────────────────────────────────────────

create table if not exists public.plans (
  id               uuid        primary key default gen_random_uuid(),
  slug             text        not null unique,
  name             text        not null,
  description      text,
  price_cents      integer,               -- BRL cents; null = custom / enterprise
  billing_interval text        not null default 'monthly'
                               check (billing_interval in ('monthly', 'yearly', 'custom')),
  features         jsonb       not null default '{}',
  limits           jsonb       not null default '{}',
  is_active        boolean     not null default true,
  recommended      boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── 2. Multi-currency columns (idempotent) ────────────────────────────────────

alter table public.plans
  add column if not exists price_usd_cents integer,
  add column if not exists price_eur_cents  integer;

-- ── 3. Updated-at trigger ─────────────────────────────────────────────────────

drop trigger if exists set_plans_updated_at on public.plans;
create trigger set_plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

alter table public.plans enable row level security;

-- Anyone (including unauthenticated visitors) can read active plans
drop policy if exists "plans_select_public" on public.plans;
drop policy if exists "plans_select_public" on public.plans;
create policy "plans_select_public" on public.plans
  for select
  using (is_active = true);

-- Only service-role (admin) can write plans — no anon/authenticated DML
drop policy if exists "plans_insert_service" on public.plans;
drop policy if exists "plans_update_service" on public.plans;

-- ── 5. Ensure unique constraint on slug (idempotent) ─────────────────────────

create unique index if not exists plans_slug_key on public.plans (slug);

-- ── 6. Upsert canonical plans ─────────────────────────────────────────────────

insert into public.plans (
  slug,
  name,
  description,
  price_cents,
  price_usd_cents,
  price_eur_cents,
  billing_interval,
  recommended,
  features,
  limits,
  is_active
)
values
  -- Starter  ──────────────────────────────────────────────────────────────────
  (
    'starter',
    'Starter',
    'Para profissionais solo e clínicas pequenas.',
    14700,    -- R$ 147
    4900,     -- US$ 49
    3900,     -- € 39
    'monthly',
    false,
    '{
      "leads": true,
      "schedule": true,
      "forms": true,
      "patient_snapshot": true,
      "ai_insights": false,
      "patient_portal": false,
      "product_support": false,
      "membership": false,
      "stripe_checkout": false,
      "follow_up_automation": false,
      "whatsapp_automation": false,
      "audio_transcription": false,
      "advanced_reports": false,
      "multi_clinic": false,
      "advanced_permissions": false,
      "white_label": false
    }'::jsonb,
    '{"users": 3, "patients": 150, "forms": 10, "ai_insights": 0, "locations": 1}'::jsonb,
    true
  ),
  -- Professional ──────────────────────────────────────────────────────────────
  (
    'professional',
    'Professional',
    'Operação clínica completa com IA.',
    29700,    -- R$ 297
    12900,    -- US$ 129
    9900,     -- € 99
    'monthly',
    true,
    '{
      "leads": true,
      "schedule": true,
      "forms": true,
      "patient_snapshot": true,
      "ai_insights": true,
      "patient_portal": true,
      "product_support": true,
      "membership": true,
      "stripe_checkout": true,
      "follow_up_automation": true,
      "whatsapp_automation": false,
      "audio_transcription": true,
      "advanced_reports": false,
      "multi_clinic": false,
      "advanced_permissions": false,
      "white_label": false
    }'::jsonb,
    '{"users": 10, "patients": 1000, "forms": 50, "ai_insights": 500, "locations": 1}'::jsonb,
    true
  ),
  -- Scale ─────────────────────────────────────────────────────────────────────
  (
    'scale',
    'Scale',
    'Para clínicas premium e times em crescimento.',
    69700,    -- R$ 697
    29900,    -- US$ 299
    22900,    -- € 229
    'monthly',
    false,
    '{
      "leads": true,
      "schedule": true,
      "forms": true,
      "patient_snapshot": true,
      "ai_insights": true,
      "patient_portal": true,
      "product_support": true,
      "membership": true,
      "stripe_checkout": true,
      "follow_up_automation": true,
      "whatsapp_automation": true,
      "audio_transcription": true,
      "advanced_reports": true,
      "multi_clinic": false,
      "advanced_permissions": true,
      "white_label": false
    }'::jsonb,
    '{"users": null, "patients": null, "forms": null, "ai_insights": null, "locations": 3}'::jsonb,
    true
  ),
  -- Enterprise ────────────────────────────────────────────────────────────────
  (
    'enterprise',
    'Enterprise',
    'Multi-unidade, white-label e onboarding dedicado.',
    null,     -- custom pricing
    null,
    null,
    'custom',
    false,
    '{
      "leads": true,
      "schedule": true,
      "forms": true,
      "patient_snapshot": true,
      "ai_insights": true,
      "patient_portal": true,
      "product_support": true,
      "membership": true,
      "stripe_checkout": true,
      "follow_up_automation": true,
      "whatsapp_automation": true,
      "audio_transcription": true,
      "advanced_reports": true,
      "multi_clinic": true,
      "advanced_permissions": true,
      "white_label": true
    }'::jsonb,
    '{"users": null, "patients": null, "forms": null, "ai_insights": null, "locations": null}'::jsonb,
    true
  )
on conflict (slug) do update set
  name             = excluded.name,
  description      = excluded.description,
  price_cents      = excluded.price_cents,
  price_usd_cents  = excluded.price_usd_cents,
  price_eur_cents  = excluded.price_eur_cents,
  billing_interval = excluded.billing_interval,
  recommended      = excluded.recommended,
  features         = excluded.features,
  limits           = excluded.limits,
  is_active        = excluded.is_active,
  updated_at       = now();
