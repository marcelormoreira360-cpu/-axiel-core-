-- AXIEL Core — Forms & Body Map foundation
-- Safe additions for custom clinic forms, patient submissions, and body map marks.

alter table public.intake_forms
  add column if not exists category text default 'Custom Form';

alter table public.intake_questions
  add column if not exists options jsonb;

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

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  form_id uuid not null references public.intake_forms(id) on delete cascade,
  summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.body_map_marks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  form_id uuid references public.intake_forms(id) on delete cascade,
  submission_id uuid references public.form_submissions(id) on delete cascade,
  body_region text not null,
  side text not null check (side in ('front', 'back')),
  note text,
  intensity integer check (intensity between 1 and 10),
  created_at timestamptz not null default now()
);

alter table public.form_templates enable row level security;
alter table public.form_submissions enable row level security;
alter table public.body_map_marks enable row level security;

drop policy if exists "clinic users can read form templates" on public.form_templates;
create policy "clinic users can read form templates"
on public.form_templates for select
using (
  is_system_template = true
  or clinic_id in (select clinic_id from public.users where id = auth.uid())
);

drop policy if exists "clinic users can manage form templates" on public.form_templates;
create policy "clinic users can manage form templates"
on public.form_templates for all
using (clinic_id in (select clinic_id from public.users where id = auth.uid()))
with check (clinic_id in (select clinic_id from public.users where id = auth.uid()));

drop policy if exists "clinic users can read form submissions" on public.form_submissions;
create policy "clinic users can read form submissions"
on public.form_submissions for select
using (clinic_id in (select clinic_id from public.users where id = auth.uid()));

drop policy if exists "clinic users can manage form submissions" on public.form_submissions;
create policy "clinic users can manage form submissions"
on public.form_submissions for all
using (clinic_id in (select clinic_id from public.users where id = auth.uid()))
with check (clinic_id in (select clinic_id from public.users where id = auth.uid()));

drop policy if exists "clinic users can read body map marks" on public.body_map_marks;
create policy "clinic users can read body map marks"
on public.body_map_marks for select
using (clinic_id in (select clinic_id from public.users where id = auth.uid()));

drop policy if exists "clinic users can manage body map marks" on public.body_map_marks;
create policy "clinic users can manage body map marks"
on public.body_map_marks for all
using (clinic_id in (select clinic_id from public.users where id = auth.uid()))
with check (clinic_id in (select clinic_id from public.users where id = auth.uid()));
