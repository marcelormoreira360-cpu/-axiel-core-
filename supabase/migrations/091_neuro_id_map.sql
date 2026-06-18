-- 091_neuro_id_map.sql
-- Mapa Bio³ / Índice Neuro ID (MVP). 3 eixos (fisico/bioquimico/emocional) → % por eixo.
-- O motor calcula DISFUNÇÃO 0–100; o display ao paciente é EQUILÍBRIO (100 − disfunção).
-- RLS multi-tenant por clinic_id; values/scores herdam o escopo via assessment_id.
-- ⚠️ NÃO aplicada automaticamente — aguardando OK do Marcelo.

-- ── Catálogo de itens por clínica (item → pilar, direção, peso, regra) ───────
create table if not exists public.assessment_items_catalog (
  id           uuid        primary key default gen_random_uuid(),
  clinic_id    uuid        not null references public.clinics(id) on delete cascade,
  code         text        not null,                 -- chave estável (ex.: 'dor', 'qsna')
  label        text        not null,
  pillar       text        not null,                 -- 'fisico' | 'bioquimico' | 'emocional'
  direction    text        not null,                 -- 'higher_worse' | 'higher_better'
  input_type   text        not null,                 -- 'scale_0_10' | 'boolean' | 'choice' | 'lab' | 'med'
  scoring_rule jsonb       not null default '{}'::jsonb,  -- normalização → 0-100
  weight       numeric     not null default 1,
  sort_order   int         not null default 0,
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (clinic_id, code)
);
create index if not exists aic_clinic_idx on public.assessment_items_catalog (clinic_id, active);

alter table public.assessment_items_catalog enable row level security;
drop policy if exists "aic_select" on public.assessment_items_catalog;
create policy "aic_select" on public.assessment_items_catalog for select using (public.can_access_clinic(clinic_id));
drop policy if exists "aic_insert" on public.assessment_items_catalog;
create policy "aic_insert" on public.assessment_items_catalog for insert with check (public.can_write_clinic_data(clinic_id));
drop policy if exists "aic_update" on public.assessment_items_catalog;
create policy "aic_update" on public.assessment_items_catalog for update using (public.can_write_clinic_data(clinic_id));
drop policy if exists "aic_delete" on public.assessment_items_catalog;
create policy "aic_delete" on public.assessment_items_catalog for delete using (public.can_write_clinic_data(clinic_id));

-- ── Avaliação do paciente ───────────────────────────────────────────────────
create table if not exists public.patient_assessments (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id)  on delete cascade,
  patient_id  uuid        not null references public.patients(id) on delete cascade,
  assessed_at timestamptz not null default now(),
  source      text        not null default 'manual',  -- 'soap' | 'questionnaire' | 'lab' | 'manual'
  status      text        not null default 'draft',    -- 'draft' | 'final'
  created_by  uuid        references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists pa_patient_idx on public.patient_assessments (patient_id, assessed_at desc);
create index if not exists pa_clinic_idx  on public.patient_assessments (clinic_id);

alter table public.patient_assessments enable row level security;
drop policy if exists "pa_select" on public.patient_assessments;
create policy "pa_select" on public.patient_assessments for select using (public.can_access_clinic(clinic_id));
drop policy if exists "pa_insert" on public.patient_assessments;
create policy "pa_insert" on public.patient_assessments for insert with check (public.can_write_clinic_data(clinic_id));
drop policy if exists "pa_update" on public.patient_assessments;
create policy "pa_update" on public.patient_assessments for update using (public.can_write_clinic_data(clinic_id));
drop policy if exists "pa_delete" on public.patient_assessments;
create policy "pa_delete" on public.patient_assessments for delete using (public.can_write_clinic_data(clinic_id));

-- ── Valores por item (herdam escopo via assessment_id) ──────────────────────
create table if not exists public.patient_assessment_values (
  id                uuid        primary key default gen_random_uuid(),
  assessment_id     uuid        not null references public.patient_assessments(id) on delete cascade,
  item_code         text        not null,
  raw_value         text,
  dysfunction_score numeric,                          -- 0-100 calculado pelo motor
  created_at        timestamptz not null default now()
);
create index if not exists pav_assessment_idx on public.patient_assessment_values (assessment_id);

alter table public.patient_assessment_values enable row level security;
drop policy if exists "pav_select" on public.patient_assessment_values;
create policy "pav_select" on public.patient_assessment_values for select using (exists (
  select 1 from public.patient_assessments a where a.id = assessment_id and public.can_access_clinic(a.clinic_id)));
drop policy if exists "pav_insert" on public.patient_assessment_values;
create policy "pav_insert" on public.patient_assessment_values for insert with check (exists (
  select 1 from public.patient_assessments a where a.id = assessment_id and public.can_write_clinic_data(a.clinic_id)));
drop policy if exists "pav_update" on public.patient_assessment_values;
create policy "pav_update" on public.patient_assessment_values for update using (exists (
  select 1 from public.patient_assessments a where a.id = assessment_id and public.can_write_clinic_data(a.clinic_id)));
drop policy if exists "pav_delete" on public.patient_assessment_values;
create policy "pav_delete" on public.patient_assessment_values for delete using (exists (
  select 1 from public.patient_assessments a where a.id = assessment_id and public.can_write_clinic_data(a.clinic_id)));

-- ── Índices Neuro ID computados (herdam escopo via assessment_id) ───────────
create table if not exists public.patient_neuro_id_scores (
  id             uuid        primary key default gen_random_uuid(),
  assessment_id  uuid        not null references public.patient_assessments(id) on delete cascade,
  patient_id     uuid        not null references public.patients(id) on delete cascade,
  fisico_pct     numeric,                              -- DISFUNÇÃO por eixo (0-100)
  bioquimico_pct numeric,
  emocional_pct  numeric,
  indice_geral   numeric,
  priority_pillar text,                                -- pilar de maior disfunção
  is_partial     boolean     not null default false,
  computed_at    timestamptz not null default now()
);
create index if not exists pnis_assessment_idx on public.patient_neuro_id_scores (assessment_id);
create index if not exists pnis_patient_idx    on public.patient_neuro_id_scores (patient_id, computed_at desc);

alter table public.patient_neuro_id_scores enable row level security;
drop policy if exists "pnis_select" on public.patient_neuro_id_scores;
create policy "pnis_select" on public.patient_neuro_id_scores for select using (exists (
  select 1 from public.patient_assessments a where a.id = assessment_id and public.can_access_clinic(a.clinic_id)));
drop policy if exists "pnis_insert" on public.patient_neuro_id_scores;
create policy "pnis_insert" on public.patient_neuro_id_scores for insert with check (exists (
  select 1 from public.patient_assessments a where a.id = assessment_id and public.can_write_clinic_data(a.clinic_id)));
drop policy if exists "pnis_update" on public.patient_neuro_id_scores;
create policy "pnis_update" on public.patient_neuro_id_scores for update using (exists (
  select 1 from public.patient_assessments a where a.id = assessment_id and public.can_write_clinic_data(a.clinic_id)));
drop policy if exists "pnis_delete" on public.patient_neuro_id_scores;
create policy "pnis_delete" on public.patient_neuro_id_scores for delete using (exists (
  select 1 from public.patient_assessments a where a.id = assessment_id and public.can_write_clinic_data(a.clinic_id)));

notify pgrst, 'reload schema';
