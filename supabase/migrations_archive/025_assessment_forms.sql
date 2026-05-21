-- ============================================================
-- 025 — Assessment / Questionnaire module
-- ============================================================

-- Form templates (created by clinic)
create table if not exists public.assessment_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  description text,
  instructions text,
  scale_labels jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(clinic_id, name)
);

-- Sections within a template (e.g. "CABEÇA", "OLHOS")
create table if not exists public.assessment_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.assessment_templates(id) on delete cascade,
  title text not null,
  order_index integer not null default 0
);

-- Questions within a section
create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.assessment_templates(id) on delete cascade,
  section_id uuid references public.assessment_sections(id) on delete cascade,
  text text not null,
  question_type text not null default 'scale', -- 'scale' | 'yes_no' | 'text' | 'number' | 'single_choice'
  min_score integer not null default 0,
  max_score integer not null default 4,
  options jsonb,
  order_index integer not null default 0,
  is_required boolean not null default true
);

-- A patient's response to a template (one row per submission)
create table if not exists public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.assessment_templates(id),
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  filled_at timestamptz not null default now(),
  total_score integer,
  max_possible_score integer,
  score_percentage numeric(5,2),
  section_scores jsonb,
  notes text,
  created_at timestamptz not null default now()
);

-- Individual answers
create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.assessment_responses(id) on delete cascade,
  question_id uuid not null references public.assessment_questions(id),
  section_id uuid references public.assessment_sections(id),
  value_number numeric,
  value_text text
);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_assessment_templates_clinic_id on public.assessment_templates(clinic_id);
create index if not exists idx_assessment_sections_template_id on public.assessment_sections(template_id);
create index if not exists idx_assessment_questions_template_id on public.assessment_questions(template_id);
create index if not exists idx_assessment_questions_section_id on public.assessment_questions(section_id);
create index if not exists idx_assessment_responses_patient_id on public.assessment_responses(patient_id);
create index if not exists idx_assessment_responses_clinic_id on public.assessment_responses(clinic_id);
create index if not exists idx_assessment_responses_template_id on public.assessment_responses(template_id);
create index if not exists idx_assessment_answers_response_id on public.assessment_answers(response_id);
create index if not exists idx_assessment_answers_question_id on public.assessment_answers(question_id);

-- ── updated_at trigger ────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_assessment_templates_updated_at on public.assessment_templates;
create or replace trigger trg_assessment_templates_updated_at
  before update on public.assessment_templates
  for each row execute function public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
alter table public.assessment_templates enable row level security;
alter table public.assessment_sections enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.assessment_answers enable row level security;

-- assessment_templates
drop policy if exists "assessment_templates_select" on public.assessment_templates;
create policy "assessment_templates_select" on public.assessment_templates
  for select using (public.can_access_clinic(clinic_id));

drop policy if exists "assessment_templates_insert" on public.assessment_templates;
create policy "assessment_templates_insert" on public.assessment_templates
  for insert with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "assessment_templates_update" on public.assessment_templates;
create policy "assessment_templates_update" on public.assessment_templates
  for update using (public.can_write_clinic_data(clinic_id))
  with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "assessment_templates_delete" on public.assessment_templates;
create policy "assessment_templates_delete" on public.assessment_templates
  for delete using (public.can_manage_clinic(clinic_id));

-- assessment_sections (inherit access via template's clinic_id)
drop policy if exists "assessment_sections_select" on public.assessment_sections;
create policy "assessment_sections_select" on public.assessment_sections
  for select using (
    exists (
      select 1 from public.assessment_templates t
      where t.id = template_id and public.can_access_clinic(t.clinic_id)
    )
  );

drop policy if exists "assessment_sections_insert" on public.assessment_sections;
create policy "assessment_sections_insert" on public.assessment_sections
  for insert with check (
    exists (
      select 1 from public.assessment_templates t
      where t.id = template_id and public.can_write_clinic_data(t.clinic_id)
    )
  );

drop policy if exists "assessment_sections_update" on public.assessment_sections;
create policy "assessment_sections_update" on public.assessment_sections
  for update using (
    exists (
      select 1 from public.assessment_templates t
      where t.id = template_id and public.can_write_clinic_data(t.clinic_id)
    )
  );

drop policy if exists "assessment_sections_delete" on public.assessment_sections;
create policy "assessment_sections_delete" on public.assessment_sections
  for delete using (
    exists (
      select 1 from public.assessment_templates t
      where t.id = template_id and public.can_manage_clinic(t.clinic_id)
    )
  );

-- assessment_questions
drop policy if exists "assessment_questions_select" on public.assessment_questions;
create policy "assessment_questions_select" on public.assessment_questions
  for select using (
    exists (
      select 1 from public.assessment_templates t
      where t.id = template_id and public.can_access_clinic(t.clinic_id)
    )
  );

drop policy if exists "assessment_questions_insert" on public.assessment_questions;
create policy "assessment_questions_insert" on public.assessment_questions
  for insert with check (
    exists (
      select 1 from public.assessment_templates t
      where t.id = template_id and public.can_write_clinic_data(t.clinic_id)
    )
  );

drop policy if exists "assessment_questions_update" on public.assessment_questions;
create policy "assessment_questions_update" on public.assessment_questions
  for update using (
    exists (
      select 1 from public.assessment_templates t
      where t.id = template_id and public.can_write_clinic_data(t.clinic_id)
    )
  );

drop policy if exists "assessment_questions_delete" on public.assessment_questions;
create policy "assessment_questions_delete" on public.assessment_questions
  for delete using (
    exists (
      select 1 from public.assessment_templates t
      where t.id = template_id and public.can_manage_clinic(t.clinic_id)
    )
  );

-- assessment_responses
drop policy if exists "assessment_responses_select" on public.assessment_responses;
create policy "assessment_responses_select" on public.assessment_responses
  for select using (public.can_access_clinic(clinic_id));

drop policy if exists "assessment_responses_insert" on public.assessment_responses;
create policy "assessment_responses_insert" on public.assessment_responses
  for insert with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "assessment_responses_update" on public.assessment_responses;
create policy "assessment_responses_update" on public.assessment_responses
  for update using (public.can_write_clinic_data(clinic_id))
  with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "assessment_responses_delete" on public.assessment_responses;
create policy "assessment_responses_delete" on public.assessment_responses
  for delete using (public.can_manage_clinic(clinic_id));

-- assessment_answers (inherit via response)
drop policy if exists "assessment_answers_select" on public.assessment_answers;
create policy "assessment_answers_select" on public.assessment_answers
  for select using (
    exists (
      select 1 from public.assessment_responses r
      where r.id = response_id and public.can_access_clinic(r.clinic_id)
    )
  );

drop policy if exists "assessment_answers_insert" on public.assessment_answers;
create policy "assessment_answers_insert" on public.assessment_answers
  for insert with check (
    exists (
      select 1 from public.assessment_responses r
      where r.id = response_id and public.can_write_clinic_data(r.clinic_id)
    )
  );

drop policy if exists "assessment_answers_delete" on public.assessment_answers;
create policy "assessment_answers_delete" on public.assessment_answers
  for delete using (
    exists (
      select 1 from public.assessment_responses r
      where r.id = response_id and public.can_manage_clinic(r.clinic_id)
    )
  );
