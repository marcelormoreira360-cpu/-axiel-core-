-- 088_supplements.sql
-- Feature de Suplementos (MVP): catálogo por clínica + recomendação por paciente + itens.
-- RLS multi-tenant por clinic_id (helpers can_access_clinic / can_write_clinic_data).
-- Itens herdam o escopo via recommendation_id (EXISTS no parent).

-- ── Catálogo por clínica ────────────────────────────────────────────────────
create table if not exists public.supplement_catalog (
  id             uuid        primary key default gen_random_uuid(),
  clinic_id      uuid        not null references public.clinics(id) on delete cascade,
  name           text        not null,
  source         text        not null,   -- manipulacao_br | dfh | pure_encapsulations | fullscript | outro
  country        text        not null,   -- BR | US
  sku            text,
  buy_url        text,
  default_dosage text,
  form           text,
  notes          text,
  active         boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists supplement_catalog_clinic_idx
  on public.supplement_catalog (clinic_id, active);

alter table public.supplement_catalog enable row level security;
drop policy if exists "supplement_catalog_select" on public.supplement_catalog;
create policy "supplement_catalog_select" on public.supplement_catalog
  for select using (public.can_access_clinic(clinic_id));
drop policy if exists "supplement_catalog_insert" on public.supplement_catalog;
create policy "supplement_catalog_insert" on public.supplement_catalog
  for insert with check (public.can_write_clinic_data(clinic_id));
drop policy if exists "supplement_catalog_update" on public.supplement_catalog;
create policy "supplement_catalog_update" on public.supplement_catalog
  for update using (public.can_write_clinic_data(clinic_id));
drop policy if exists "supplement_catalog_delete" on public.supplement_catalog;
create policy "supplement_catalog_delete" on public.supplement_catalog
  for delete using (public.can_write_clinic_data(clinic_id));

-- ── Recomendação por paciente ───────────────────────────────────────────────
create table if not exists public.patient_supplement_recommendations (
  id                   uuid        primary key default gen_random_uuid(),
  clinic_id            uuid        not null references public.clinics(id)  on delete cascade,
  patient_id           uuid        not null references public.patients(id) on delete cascade,
  report_id            uuid        references public.ai_insights(id) on delete set null,
  status               text        not null default 'draft',   -- draft | reviewed | approved | sent
  output_type          text        not null,                   -- br_formula | us_link
  source_of_suggestion text        not null default 'manual',  -- ai | manual
  rationale_summary    text,
  created_by           uuid        references public.users(id) on delete set null,
  reviewed_by          uuid        references public.users(id) on delete set null,
  approved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists psr_patient_idx
  on public.patient_supplement_recommendations (patient_id, created_at desc);
create index if not exists psr_clinic_idx
  on public.patient_supplement_recommendations (clinic_id);

alter table public.patient_supplement_recommendations enable row level security;
drop policy if exists "psr_select" on public.patient_supplement_recommendations;
create policy "psr_select" on public.patient_supplement_recommendations
  for select using (public.can_access_clinic(clinic_id));
drop policy if exists "psr_insert" on public.patient_supplement_recommendations;
create policy "psr_insert" on public.patient_supplement_recommendations
  for insert with check (public.can_write_clinic_data(clinic_id));
drop policy if exists "psr_update" on public.patient_supplement_recommendations;
create policy "psr_update" on public.patient_supplement_recommendations
  for update using (public.can_write_clinic_data(clinic_id));
drop policy if exists "psr_delete" on public.patient_supplement_recommendations;
create policy "psr_delete" on public.patient_supplement_recommendations
  for delete using (public.can_write_clinic_data(clinic_id));

-- ── Itens da recomendação (herdam escopo via recommendation_id) ─────────────
create table if not exists public.patient_supplement_recommendation_items (
  id                uuid        primary key default gen_random_uuid(),
  recommendation_id uuid        not null references public.patient_supplement_recommendations(id) on delete cascade,
  catalog_id        uuid        references public.supplement_catalog(id) on delete set null,
  name              text        not null,
  dosage            text,
  timing            text,
  duration          text,
  rationale         text,
  buy_url           text,
  source_country    text,
  sort_order        int         not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists psri_recommendation_idx
  on public.patient_supplement_recommendation_items (recommendation_id, sort_order);

alter table public.patient_supplement_recommendation_items enable row level security;
drop policy if exists "psri_select" on public.patient_supplement_recommendation_items;
create policy "psri_select" on public.patient_supplement_recommendation_items
  for select using (exists (
    select 1 from public.patient_supplement_recommendations r
    where r.id = recommendation_id and public.can_access_clinic(r.clinic_id)
  ));
drop policy if exists "psri_insert" on public.patient_supplement_recommendation_items;
create policy "psri_insert" on public.patient_supplement_recommendation_items
  for insert with check (exists (
    select 1 from public.patient_supplement_recommendations r
    where r.id = recommendation_id and public.can_write_clinic_data(r.clinic_id)
  ));
drop policy if exists "psri_update" on public.patient_supplement_recommendation_items;
create policy "psri_update" on public.patient_supplement_recommendation_items
  for update using (exists (
    select 1 from public.patient_supplement_recommendations r
    where r.id = recommendation_id and public.can_write_clinic_data(r.clinic_id)
  ));
drop policy if exists "psri_delete" on public.patient_supplement_recommendation_items;
create policy "psri_delete" on public.patient_supplement_recommendation_items
  for delete using (exists (
    select 1 from public.patient_supplement_recommendations r
    where r.id = recommendation_id and public.can_write_clinic_data(r.clinic_id)
  ));

notify pgrst, 'reload schema';
