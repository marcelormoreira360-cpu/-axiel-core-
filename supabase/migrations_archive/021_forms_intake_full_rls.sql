-- AXIEL Core — Forms / Intake full foundation + RLS
-- Execution 02: custom Forms, questions, submissions, responses, and Body Map.
-- This migration is intentionally safe to run after the existing intake migration.

-- 1) Expand existing question type enum used by intake_questions.
do $$
begin
  alter type public.intake_question_type add value if not exists 'multiple_choice';
exception when duplicate_object then null;
end $$;

do $$
begin
  alter type public.intake_question_type add value if not exists 'checkbox';
exception when duplicate_object then null;
end $$;

do $$
begin
  alter type public.intake_question_type add value if not exists 'scale_1_10';
exception when duplicate_object then null;
end $$;

do $$
begin
  alter type public.intake_question_type add value if not exists 'body_map';
exception when duplicate_object then null;
end $$;

-- 2) Evolve intake_forms.
alter table public.intake_forms
  add column if not exists category text not null default 'Custom Form';

alter table public.intake_forms
  add column if not exists description text;

alter table public.intake_forms
  add column if not exists is_active boolean not null default false;

alter table public.intake_forms
  add column if not exists created_at timestamptz not null default now();

alter table public.intake_forms
  add column if not exists updated_at timestamptz not null default now();

-- 3) Evolve intake_questions.
alter table public.intake_questions
  add column if not exists options jsonb not null default '[]'::jsonb;

alter table public.intake_questions
  add column if not exists is_required boolean not null default false;

alter table public.intake_questions
  add column if not exists display_order integer not null default 0;

alter table public.intake_questions
  add column if not exists created_at timestamptz not null default now();

alter table public.intake_questions
  add column if not exists updated_at timestamptz not null default now();

-- Ensure options is never null.
update public.intake_questions
set options = '[]'::jsonb
where options is null;

alter table public.intake_questions
  alter column options set default '[]'::jsonb,
  alter column options set not null;

-- 4) Create form submissions.
create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  form_id uuid not null references public.intake_forms(id) on delete cascade,
  status text not null default 'submitted',
  summary text,
  submitted_at timestamptz default now(),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_submissions_status_check check (status in ('draft', 'submitted', 'reviewed'))
);

alter table public.form_submissions
  add column if not exists status text not null default 'submitted';

alter table public.form_submissions
  add column if not exists summary text;

alter table public.form_submissions
  add column if not exists submitted_at timestamptz default now();

alter table public.form_submissions
  add column if not exists created_by uuid references public.users(id) on delete set null;

alter table public.form_submissions
  add column if not exists updated_at timestamptz not null default now();

-- 5) Evolve intake_responses for repeat submissions and structured answers.
alter table public.intake_responses
  add column if not exists submission_id uuid references public.form_submissions(id) on delete cascade;

-- Remove the old one-answer-per-patient/question constraint if it exists.
alter table public.intake_responses
  drop constraint if exists intake_responses_patient_id_question_id_key;

-- Convert answer from text to jsonb when needed.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'intake_responses'
      and column_name = 'answer'
      and data_type <> 'jsonb'
  ) then
    alter table public.intake_responses
      alter column answer drop default;

    alter table public.intake_responses
      alter column answer type jsonb
      using case
        when answer is null then '{}'::jsonb
        else jsonb_build_object('value', answer)
      end;
  end if;
end $$;

alter table public.intake_responses
  alter column answer set default '{}'::jsonb;

-- Existing patient_id was originally NOT NULL. Keep it if already required, but allow lead forms later only if needed manually.
alter table public.intake_responses
  add column if not exists updated_at timestamptz not null default now();

-- 6) Body Map marks.
create table if not exists public.body_map_marks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  form_id uuid references public.intake_forms(id) on delete cascade,
  submission_id uuid references public.form_submissions(id) on delete cascade,
  body_region text not null,
  side text,
  note text,
  intensity integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_map_side_check check (side is null or side in ('front', 'back')),
  constraint body_map_intensity_check check (intensity is null or intensity between 1 and 10)
);

-- 7) Optional templates table for reusable clinic/system templates.
create table if not exists public.form_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  name text not null,
  description text,
  category text not null default 'Custom Form',
  questions jsonb not null default '[]'::jsonb,
  is_system_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8) Indexes.
create index if not exists intake_forms_clinic_id_idx on public.intake_forms(clinic_id);
create index if not exists intake_forms_category_idx on public.intake_forms(category);
create index if not exists intake_questions_clinic_id_idx on public.intake_questions(clinic_id);
create index if not exists intake_questions_form_id_idx on public.intake_questions(form_id);
create index if not exists intake_questions_display_order_idx on public.intake_questions(form_id, display_order);
create index if not exists form_submissions_clinic_id_idx on public.form_submissions(clinic_id);
create index if not exists form_submissions_patient_id_idx on public.form_submissions(patient_id);
create index if not exists form_submissions_form_id_idx on public.form_submissions(form_id);
create index if not exists intake_responses_clinic_id_idx on public.intake_responses(clinic_id);
create index if not exists intake_responses_submission_id_idx on public.intake_responses(submission_id);
create index if not exists intake_responses_patient_id_idx on public.intake_responses(patient_id);
create index if not exists body_map_marks_clinic_id_idx on public.body_map_marks(clinic_id);
create index if not exists body_map_marks_submission_id_idx on public.body_map_marks(submission_id);
create index if not exists body_map_marks_patient_id_idx on public.body_map_marks(patient_id);
create index if not exists form_templates_clinic_id_idx on public.form_templates(clinic_id);

-- 9) updated_at triggers.
do $$
begin
  if to_regprocedure('public.set_updated_at()') is not null then
    drop trigger if exists set_form_submissions_updated_at on public.form_submissions;
    create trigger set_form_submissions_updated_at
    before update on public.form_submissions
    for each row execute function public.set_updated_at();

    drop trigger if exists set_body_map_marks_updated_at on public.body_map_marks;
    create trigger set_body_map_marks_updated_at
    before update on public.body_map_marks
    for each row execute function public.set_updated_at();

    drop trigger if exists set_form_templates_updated_at on public.form_templates;
    create trigger set_form_templates_updated_at
    before update on public.form_templates
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- 10) Enable RLS.
alter table public.intake_forms enable row level security;
alter table public.intake_questions enable row level security;
alter table public.intake_responses enable row level security;
alter table public.form_submissions enable row level security;
alter table public.body_map_marks enable row level security;
alter table public.form_templates enable row level security;

-- 11) RLS policies for intake_forms.
drop policy if exists "Clinic users can view intake forms in their clinic" on public.intake_forms;
drop policy if exists "Clinic users can create intake forms in their clinic" on public.intake_forms;
drop policy if exists "Clinic users can update intake forms in their clinic" on public.intake_forms;
drop policy if exists "Only admins and clinic owners can delete intake forms" on public.intake_forms;

create policy "Clinic users can view intake forms in their clinic"
on public.intake_forms for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create intake forms in their clinic"
on public.intake_forms for insert
to authenticated
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic users can update intake forms in their clinic"
on public.intake_forms for update
to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic managers can delete intake forms"
on public.intake_forms for delete
to authenticated
using (public.can_manage_clinic(clinic_id));

-- 12) RLS policies for intake_questions.
drop policy if exists "Clinic users can view intake questions in their clinic" on public.intake_questions;
drop policy if exists "Clinic users can create intake questions in their clinic" on public.intake_questions;
drop policy if exists "Clinic users can update intake questions in their clinic" on public.intake_questions;
drop policy if exists "Clinic managers can delete intake questions" on public.intake_questions;

create policy "Clinic users can view intake questions in their clinic"
on public.intake_questions for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create intake questions in their clinic"
on public.intake_questions for insert
to authenticated
with check (
  public.can_write_clinic_data(clinic_id)
  and exists (
    select 1 from public.intake_forms f
    where f.id = form_id and f.clinic_id = intake_questions.clinic_id
  )
);

create policy "Clinic users can update intake questions in their clinic"
on public.intake_questions for update
to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (
  public.can_write_clinic_data(clinic_id)
  and exists (
    select 1 from public.intake_forms f
    where f.id = form_id and f.clinic_id = intake_questions.clinic_id
  )
);

create policy "Clinic managers can delete intake questions"
on public.intake_questions for delete
to authenticated
using (public.can_manage_clinic(clinic_id));

-- 13) RLS policies for form_submissions.
drop policy if exists "Clinic users can view form submissions in their clinic" on public.form_submissions;
drop policy if exists "Clinic users can create form submissions in their clinic" on public.form_submissions;
drop policy if exists "Clinic users can update form submissions in their clinic" on public.form_submissions;
drop policy if exists "Clinic managers can delete form submissions" on public.form_submissions;

create policy "Clinic users can view form submissions in their clinic"
on public.form_submissions for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create form submissions in their clinic"
on public.form_submissions for insert
to authenticated
with check (
  public.can_write_clinic_data(clinic_id)
  and exists (
    select 1 from public.intake_forms f
    where f.id = form_id and f.clinic_id = form_submissions.clinic_id
  )
  and (
    patient_id is null
    or exists (
      select 1 from public.patients p
      where p.id = patient_id and p.clinic_id = form_submissions.clinic_id
    )
  )
);

create policy "Clinic users can update form submissions in their clinic"
on public.form_submissions for update
to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic managers can delete form submissions"
on public.form_submissions for delete
to authenticated
using (public.can_manage_clinic(clinic_id));

-- 14) RLS policies for intake_responses.
drop policy if exists "Clinic users can view intake responses in their clinic" on public.intake_responses;
drop policy if exists "Clinic users can create intake responses in their clinic" on public.intake_responses;
drop policy if exists "Clinic users can update intake responses in their clinic" on public.intake_responses;
drop policy if exists "Clinic managers can delete intake responses" on public.intake_responses;

create policy "Clinic users can view intake responses in their clinic"
on public.intake_responses for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create intake responses in their clinic"
on public.intake_responses for insert
to authenticated
with check (
  public.can_write_clinic_data(clinic_id)
  and exists (
    select 1 from public.intake_forms f
    where f.id = form_id and f.clinic_id = intake_responses.clinic_id
  )
  and exists (
    select 1 from public.intake_questions q
    where q.id = question_id
      and q.form_id = intake_responses.form_id
      and q.clinic_id = intake_responses.clinic_id
  )
  and (
    submission_id is null
    or exists (
      select 1 from public.form_submissions s
      where s.id = submission_id and s.clinic_id = intake_responses.clinic_id
    )
  )
);

create policy "Clinic users can update intake responses in their clinic"
on public.intake_responses for update
to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic managers can delete intake responses"
on public.intake_responses for delete
to authenticated
using (public.can_manage_clinic(clinic_id));

-- 15) RLS policies for body_map_marks.
drop policy if exists "Clinic users can view body map marks in their clinic" on public.body_map_marks;
drop policy if exists "Clinic users can create body map marks in their clinic" on public.body_map_marks;
drop policy if exists "Clinic users can update body map marks in their clinic" on public.body_map_marks;
drop policy if exists "Clinic managers can delete body map marks" on public.body_map_marks;

create policy "Clinic users can view body map marks in their clinic"
on public.body_map_marks for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create body map marks in their clinic"
on public.body_map_marks for insert
to authenticated
with check (
  public.can_write_clinic_data(clinic_id)
  and (
    form_id is null
    or exists (
      select 1 from public.intake_forms f
      where f.id = form_id and f.clinic_id = body_map_marks.clinic_id
    )
  )
  and (
    submission_id is null
    or exists (
      select 1 from public.form_submissions s
      where s.id = submission_id and s.clinic_id = body_map_marks.clinic_id
    )
  )
);

create policy "Clinic users can update body map marks in their clinic"
on public.body_map_marks for update
to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic managers can delete body map marks"
on public.body_map_marks for delete
to authenticated
using (public.can_manage_clinic(clinic_id));

-- 16) RLS policies for form_templates.
drop policy if exists "Clinic users can view form templates" on public.form_templates;
drop policy if exists "Clinic users can create form templates" on public.form_templates;
drop policy if exists "Clinic users can update form templates" on public.form_templates;
drop policy if exists "Clinic managers can delete form templates" on public.form_templates;

create policy "Clinic users can view form templates"
on public.form_templates for select
to authenticated
using (is_system_template = true or public.can_access_clinic(clinic_id));

create policy "Clinic users can create form templates"
on public.form_templates for insert
to authenticated
with check (
  is_system_template = false
  and clinic_id is not null
  and public.can_write_clinic_data(clinic_id)
);

create policy "Clinic users can update form templates"
on public.form_templates for update
to authenticated
using (clinic_id is not null and public.can_write_clinic_data(clinic_id))
with check (clinic_id is not null and public.can_write_clinic_data(clinic_id));

create policy "Clinic managers can delete form templates"
on public.form_templates for delete
to authenticated
using (clinic_id is not null and public.can_manage_clinic(clinic_id));
