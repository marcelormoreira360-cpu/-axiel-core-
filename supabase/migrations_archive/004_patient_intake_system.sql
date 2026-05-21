-- AXIEL Core patient intake system
-- Adds clinic-customizable intake forms, questions, and patient responses.

do $$ begin
  create type public.intake_question_type as enum ('short_text', 'long_text', 'number', 'date', 'yes_no');
exception when duplicate_object then null;
end $$;

create table if not exists public.intake_forms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  name text not null default 'Patient Intake',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intake_questions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  form_id uuid not null references public.intake_forms(id) on delete cascade,
  label text not null,
  question_type public.intake_question_type not null default 'short_text',
  is_required boolean not null default false,
  display_order integer not null default 0,
  placeholder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intake_responses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  form_id uuid not null references public.intake_forms(id) on delete cascade,
  question_id uuid not null references public.intake_questions(id) on delete cascade,
  answer text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, question_id)
);

create index if not exists intake_forms_clinic_id_idx on public.intake_forms(clinic_id);
create index if not exists intake_questions_clinic_id_idx on public.intake_questions(clinic_id);
create index if not exists intake_questions_form_id_idx on public.intake_questions(form_id);
create index if not exists intake_responses_clinic_id_idx on public.intake_responses(clinic_id);
create index if not exists intake_responses_patient_id_idx on public.intake_responses(patient_id);
create index if not exists intake_responses_form_id_idx on public.intake_responses(form_id);

-- updated_at triggers
create or replace trigger set_intake_forms_updated_at
before update on public.intake_forms
for each row execute function public.set_updated_at();

create or replace trigger set_intake_questions_updated_at
before update on public.intake_questions
for each row execute function public.set_updated_at();

create or replace trigger set_intake_responses_updated_at
before update on public.intake_responses
for each row execute function public.set_updated_at();

alter table public.intake_forms enable row level security;
alter table public.intake_questions enable row level security;
alter table public.intake_responses enable row level security;

-- Intake forms
create policy "Clinic users can view intake forms in their clinic"
on public.intake_forms for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create intake forms in their clinic"
on public.intake_forms for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update intake forms in their clinic"
on public.intake_forms for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete intake forms"
on public.intake_forms for delete
to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);

-- Intake questions
create policy "Clinic users can view intake questions in their clinic"
on public.intake_questions for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create intake questions in their clinic"
on public.intake_questions for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update intake questions in their clinic"
on public.intake_questions for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete intake questions"
on public.intake_questions for delete
to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);

-- Intake responses
create policy "Clinic users can view intake responses in their clinic"
on public.intake_responses for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create intake responses in their clinic"
on public.intake_responses for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update intake responses in their clinic"
on public.intake_responses for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete intake responses"
on public.intake_responses for delete
to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);
