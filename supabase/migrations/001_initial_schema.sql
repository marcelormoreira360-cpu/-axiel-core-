-- AXIEL Core authentication and multi-tenant database schema
-- Run this file in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

-- Application roles, not Postgres roles.
-- Supabase recommends app-level RBAC + RLS for product permissions.
do $$ begin
  create type public.app_role as enum ('admin', 'clinic_owner', 'staff');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.patient_status as enum ('active', 'inactive', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lead_source as enum ('website', 'instagram', 'facebook', 'google', 'referral', 'other');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lead_stage as enum ('new_lead', 'contacted', 'scheduled', 'converted_to_patient');
exception when duplicate_object then
  -- Existing projects may already have the old starter enum.
  -- Add the CRM stages safely without removing old values.
  alter type public.lead_stage add value if not exists 'new_lead';
  alter type public.lead_stage add value if not exists 'contacted';
  alter type public.lead_stage add value if not exists 'scheduled';
  alter type public.lead_stage add value if not exists 'converted_to_patient';
end $$;

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Public user profile table linked to Supabase Auth.
-- Admin users are platform owners and may have clinic_id = null.
-- Clinic Owner and Staff users are normally assigned to one clinic. New auth users start unassigned until configured.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
  role public.app_role not null default 'staff',
  full_name text,
  email text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  date_of_birth date,
  status public.patient_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  converted_patient_id uuid references public.patients(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  source public.lead_source not null default 'other',
  stage public.lead_stage not null default 'new_lead',
  main_complaint text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_clinic_id_idx on public.users(clinic_id);
create index if not exists patients_clinic_id_idx on public.patients(clinic_id);
create index if not exists leads_clinic_id_idx on public.leads(clinic_id);
create index if not exists leads_stage_idx on public.leads(stage);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  starts_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0 and duration_minutes <= 480),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_clinic_id_idx on public.appointments(clinic_id);
create index if not exists appointments_patient_id_idx on public.appointments(patient_id);
create index if not exists appointments_starts_at_idx on public.appointments(starts_at);


create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_clinics_updated_at on public.clinics;
create trigger set_clinics_updated_at
before update on public.clinics
for each row execute function public.set_updated_at();

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_patients_updated_at on public.patients;
create trigger set_patients_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

drop trigger if exists set_leads_updated_at on public.leads;
create trigger set_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();


-- Security helper functions.
create or replace function public.current_user_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.current_user_clinic_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select clinic_id from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.can_access_clinic(target_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.is_admin()
    or public.current_user_clinic_id() = target_clinic_id,
    false
  );
$$;

-- Automatically create a profile row when a Supabase Auth user is created.
-- The default profile is staff with no clinic and must be assigned by an admin or manually in SQL.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, email, role, clinic_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'staff',
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- RLS
alter table public.clinics enable row level security;
alter table public.users enable row level security;
alter table public.patients enable row level security;
alter table public.leads enable row level security;
alter table public.appointments enable row level security;

-- Clinics
create policy "Admins can manage all clinics"
on public.clinics for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Clinic users can view their clinic"
on public.clinics for select
to authenticated
using (public.can_access_clinic(id));

-- Users
create policy "Users can view their own profile"
on public.users for select
to authenticated
using (id = auth.uid());

create policy "Admins can manage all users"
on public.users for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Clinic owners can view users in their clinic"
on public.users for select
to authenticated
using (
  public.current_user_role()::text = 'clinic_owner'
  and clinic_id = public.current_user_clinic_id()
);

create policy "Clinic owners can update staff in their clinic"
on public.users for update
to authenticated
using (
  public.current_user_role()::text = 'clinic_owner'
  and clinic_id = public.current_user_clinic_id()
  and role = 'staff'
)
with check (
  public.current_user_role()::text = 'clinic_owner'
  and clinic_id = public.current_user_clinic_id()
  and role = 'staff'
);

-- Patients
create policy "Clinic users can view patients in their clinic"
on public.patients for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic owners and staff can create patients in their clinic"
on public.patients for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic owners and staff can update patients in their clinic"
on public.patients for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete patients"
on public.patients for delete
to authenticated
using (
  public.is_admin()
  or (
    public.current_user_role()::text = 'clinic_owner'
    and clinic_id = public.current_user_clinic_id()
  )
);

-- Leads
create policy "Clinic users can view leads in their clinic"
on public.leads for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic owners and staff can create leads in their clinic"
on public.leads for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic owners and staff can update leads in their clinic"
on public.leads for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete leads"
on public.leads for delete
to authenticated
using (
  public.is_admin()
  or (
    public.current_user_role()::text = 'clinic_owner'
    and clinic_id = public.current_user_clinic_id()
  )
);

-- Appointments / generic sessions
create policy "Clinic users can view appointments in their clinic"
on public.appointments for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic owners and staff can create appointments in their clinic"
on public.appointments for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic owners and staff can update appointments in their clinic"
on public.appointments for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete appointments"
on public.appointments for delete
to authenticated
using (
  public.is_admin()
  or (
    public.current_user_role()::text = 'clinic_owner'
    and clinic_id = public.current_user_clinic_id()
  )
);


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
drop trigger if exists set_intake_forms_updated_at on public.intake_forms;
create trigger set_intake_forms_updated_at
before update on public.intake_forms
for each row execute function public.set_updated_at();

drop trigger if exists set_intake_questions_updated_at on public.intake_questions;
create trigger set_intake_questions_updated_at
before update on public.intake_questions
for each row execute function public.set_updated_at();

drop trigger if exists set_intake_responses_updated_at on public.intake_responses;
create trigger set_intake_responses_updated_at
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
  or (public.current_user_role()::text = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
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
  or (public.current_user_role()::text = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
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
  or (public.current_user_role()::text = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);


-- Bootstrap example after creating first Supabase Auth user:
-- update public.users set role = 'admin' where email = 'your-email@example.com';
-- insert into public.clinics (name, slug) values ('Integrative & Functional Wellness Center', 'ifwc') returning id;
-- update public.users set role = 'clinic_owner', clinic_id = 'CLINIC_ID' where email = 'owner@example.com';

-- AXIEL Core session recording interface
-- Minimal notes + key observations during a generic patient session.

create table if not exists public.session_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  notes text,
  key_observations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id)
);

create index if not exists session_records_clinic_id_idx on public.session_records(clinic_id);
create index if not exists session_records_appointment_id_idx on public.session_records(appointment_id);
create index if not exists session_records_patient_id_idx on public.session_records(patient_id);

drop trigger if exists set_session_records_updated_at on public.session_records;
create trigger set_session_records_updated_at
before update on public.session_records
for each row execute function public.set_updated_at();

alter table public.session_records enable row level security;

create policy "Clinic users can view session records in their clinic"
on public.session_records for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create session records in their clinic"
on public.session_records for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update session records in their clinic"
on public.session_records for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete session records"
on public.session_records for delete
to authenticated
using (
  public.is_admin()
  or (public.current_user_role()::text = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);
-- AXIEL Core AI Insight module
-- Stores structured AI-generated insights for each patient.
-- The AI output is explicitly non-diagnostic and not medical advice.

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  input_snapshot jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('completed', 'error')),
  created_at timestamptz not null default now()
);

create index if not exists ai_insights_clinic_id_idx on public.ai_insights(clinic_id);
create index if not exists ai_insights_patient_id_idx on public.ai_insights(patient_id);
create index if not exists ai_insights_created_at_idx on public.ai_insights(created_at desc);

alter table public.ai_insights enable row level security;

create policy "Clinic users can view AI insights in their clinic"
on public.ai_insights for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create AI insights in their clinic"
on public.ai_insights for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete AI insights"
on public.ai_insights for delete
to authenticated
using (
  public.is_admin()
  or (public.current_user_role()::text = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);
-- AXIEL Core follow-up system
-- Structured reminders and message placeholders only. No real automation is executed.

do $$ begin
  create type public.follow_up_status as enum ('pending', 'completed', 'canceled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.follow_up_channel as enum ('none', 'email', 'sms');
exception when duplicate_object then null;
end $$;

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  title text not null default 'Next session reminder',
  due_at timestamptz not null,
  status public.follow_up_status not null default 'pending',
  channel public.follow_up_channel not null default 'none',
  message_subject text,
  message_body text,
  notes text,
  ai_suggested_timing text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists follow_ups_clinic_id_idx on public.follow_ups(clinic_id);
create index if not exists follow_ups_patient_id_idx on public.follow_ups(patient_id);
create index if not exists follow_ups_appointment_id_idx on public.follow_ups(appointment_id);
create index if not exists follow_ups_due_at_idx on public.follow_ups(due_at);
create index if not exists follow_ups_status_idx on public.follow_ups(status);

drop trigger if exists set_follow_ups_updated_at on public.follow_ups;
create trigger set_follow_ups_updated_at
before update on public.follow_ups
for each row execute function public.set_updated_at();

alter table public.follow_ups enable row level security;

create policy "Clinic users can view follow ups in their clinic"
on public.follow_ups for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create follow ups in their clinic"
on public.follow_ups for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update follow ups in their clinic"
on public.follow_ups for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete follow ups"
on public.follow_ups for delete
to authenticated
using (
  public.is_admin()
  or (public.current_user_role()::text = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);
-- AXIEL Core monetization module
-- Simple clinic-defined packages and memberships. No payment processing yet.

do $$ begin
  create type public.monetization_offer_type as enum ('session_package', 'membership');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.patient_offer_status as enum ('active', 'completed', 'canceled');
exception when duplicate_object then null;
end $$;

create table if not exists public.monetization_offers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  name text not null,
  offer_type public.monetization_offer_type not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'USD',
  number_of_sessions integer not null default 1 check (number_of_sessions > 0 and number_of_sessions <= 500),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_offers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  offer_id uuid not null references public.monetization_offers(id) on delete restrict,
  created_by uuid references public.users(id) on delete set null,
  status public.patient_offer_status not null default 'active',
  sessions_total integer not null check (sessions_total > 0 and sessions_total <= 500),
  sessions_used integer not null default 0 check (sessions_used >= 0),
  starts_at date not null default current_date,
  ends_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sessions_used <= sessions_total)
);

create index if not exists monetization_offers_clinic_id_idx on public.monetization_offers(clinic_id);
create index if not exists monetization_offers_offer_type_idx on public.monetization_offers(offer_type);
create index if not exists patient_offers_clinic_id_idx on public.patient_offers(clinic_id);
create index if not exists patient_offers_patient_id_idx on public.patient_offers(patient_id);
create index if not exists patient_offers_offer_id_idx on public.patient_offers(offer_id);
create index if not exists patient_offers_status_idx on public.patient_offers(status);

drop trigger if exists set_monetization_offers_updated_at on public.monetization_offers;
create trigger set_monetization_offers_updated_at
before update on public.monetization_offers
for each row execute function public.set_updated_at();

drop trigger if exists set_patient_offers_updated_at on public.patient_offers;
create trigger set_patient_offers_updated_at
before update on public.patient_offers
for each row execute function public.set_updated_at();

alter table public.monetization_offers enable row level security;
alter table public.patient_offers enable row level security;

create policy "Clinic users can view monetization offers in their clinic"
on public.monetization_offers for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create monetization offers in their clinic"
on public.monetization_offers for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update monetization offers in their clinic"
on public.monetization_offers for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete monetization offers"
on public.monetization_offers for delete
to authenticated
using (
  public.is_admin()
  or (public.current_user_role()::text = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);

create policy "Clinic users can view patient offers in their clinic"
on public.patient_offers for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create patient offers in their clinic"
on public.patient_offers for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update patient offers in their clinic"
on public.patient_offers for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete patient offers"
on public.patient_offers for delete
to authenticated
using (
  public.is_admin()
  or (public.current_user_role()::text = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);
-- AXIEL Core SaaS Foundation hardening
-- Adds stronger tenant isolation, scalable clinic memberships, billing foundation,
-- audit logs, feature flags, soft-delete columns, AI governance, and support tables.

-- 1) Expand app roles safely.
alter type public.app_role add value if not exists 'platform_admin';
alter type public.app_role add value if not exists 'platform_support';
alter type public.app_role add value if not exists 'clinic_manager';
alter type public.app_role add value if not exists 'practitioner';
alter type public.app_role add value if not exists 'front_desk';
alter type public.app_role add value if not exists 'read_only_staff';

-- 2) SaaS billing + platform foundation tables.
do $$ begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'paused');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.clinic_user_status as enum ('invited', 'active', 'disabled');
exception when duplicate_object then null;
end $$;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'USD',
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  max_users integer,
  max_patients integer,
  ai_insights_included integer,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  external_customer_id text,
  external_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id)
);

create table if not exists public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade unique,
  display_name text,
  timezone text not null default 'America/New_York',
  ai_enabled boolean not null default false,
  patient_reports_enabled boolean not null default true,
  default_currency text not null default 'USD',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_users (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.app_role not null default 'staff',
  status public.clinic_user_status not null default 'active',
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  email text not null,
  role public.app_role not null default 'staff',
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references public.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  flag_key text not null,
  is_enabled boolean not null default false,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, flag_key)
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  event_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 3) AI governance tables.
create table if not exists public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  requested_by uuid references public.users(id) on delete set null,
  model text,
  purpose text not null default 'structured_insight',
  input_summary jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'completed', 'error')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ai_review_status (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  ai_insight_id uuid not null references public.ai_insights(id) on delete cascade unique,
  reviewed_by uuid references public.users(id) on delete set null,
  status text not null default 'needs_review' check (status in ('needs_review', 'reviewed', 'archived')),
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Soft delete and audit metadata columns on clinic-owned tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'patients', 'leads', 'appointments', 'intake_forms', 'intake_questions', 'intake_responses',
    'session_records', 'ai_insights', 'follow_ups', 'monetization_offers', 'patient_offers'
  ]
  loop
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('alter table public.%I add column if not exists updated_by uuid references public.users(id) on delete set null', t);
  end loop;
end $$;

-- 5) Indexes.
create index if not exists subscriptions_clinic_id_idx on public.subscriptions(clinic_id);
create index if not exists clinic_users_clinic_id_idx on public.clinic_users(clinic_id);
create index if not exists clinic_users_user_id_idx on public.clinic_users(user_id);
create index if not exists invites_clinic_id_idx on public.invites(clinic_id);
create index if not exists feature_flags_clinic_id_idx on public.feature_flags(clinic_id);
create index if not exists usage_events_clinic_id_idx on public.usage_events(clinic_id);
create index if not exists audit_logs_clinic_id_idx on public.audit_logs(clinic_id);
create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists ai_requests_clinic_id_idx on public.ai_requests(clinic_id);
create index if not exists ai_review_status_clinic_id_idx on public.ai_review_status(clinic_id);

-- 6) Updated_at triggers for new tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'plans', 'subscriptions', 'clinic_settings', 'clinic_users', 'invites', 'feature_flags', 'ai_review_status'
  ]
  loop
    execute format('drop trigger if exists set_%s_updated_at on public.%I', t, t);
    execute format('create trigger set_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- 7) Stronger helper functions.
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role()::text in ('admin', 'platform_admin'), false);
$$;

create or replace function public.is_platform_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role()::text in ('admin', 'platform_admin', 'platform_support'), false);
$$;

create or replace function public.current_membership_role(target_clinic_id uuid)
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select cu.role
      from public.clinic_users cu
      where cu.user_id = auth.uid()
        and cu.clinic_id = target_clinic_id
        and cu.status = 'active'
      limit 1
    ),
    (
      select u.role
      from public.users u
      where u.id = auth.uid()
        and u.clinic_id = target_clinic_id
      limit 1
    )
  );
$$;

create or replace function public.can_access_clinic(target_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.is_platform_staff()
    or public.current_user_clinic_id() = target_clinic_id
    or exists (
      select 1
      from public.clinic_users cu
      where cu.user_id = auth.uid()
        and cu.clinic_id = target_clinic_id
        and cu.status = 'active'
    ),
    false
  );
$$;

create or replace function public.can_manage_clinic(target_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.is_platform_admin()
    or public.current_membership_role(target_clinic_id)::text in ('clinic_owner', 'clinic_manager')
    or (
      public.current_user_role()::text = 'clinic_owner'
      and public.current_user_clinic_id() = target_clinic_id
    ),
    false
  );
$$;

create or replace function public.can_write_clinic_data(target_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    public.is_platform_admin()
    or public.current_membership_role(target_clinic_id)::text in ('clinic_owner', 'clinic_manager', 'practitioner', 'front_desk', 'staff')
    or (
      public.current_user_role()::text in ('clinic_owner', 'staff')
      and public.current_user_clinic_id() = target_clinic_id
    ),
    false
  );
$$;

-- Keep old is_admin function compatible with legacy app code.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_platform_admin();
$$;

-- 8) Cross-clinic relationship protection.
create or replace function public.assert_same_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_clinic_id uuid;
begin
  if tg_table_name = 'appointments' then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the appointment';
    end if;
  elsif tg_table_name = 'leads' then
    if new.converted_patient_id is not null then
      select clinic_id into related_clinic_id from public.patients where id = new.converted_patient_id;
      if related_clinic_id is null or related_clinic_id <> new.clinic_id then
        raise exception 'Converted patient must belong to the same clinic as the lead';
      end if;
    end if;
  elsif tg_table_name = 'intake_questions' then
    select clinic_id into related_clinic_id from public.intake_forms where id = new.form_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Intake form must belong to the same clinic as the question';
    end if;
  elsif tg_table_name = 'intake_responses' then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the intake response';
    end if;
    select clinic_id into related_clinic_id from public.intake_forms where id = new.form_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Intake form must belong to the same clinic as the intake response';
    end if;
    select clinic_id into related_clinic_id from public.intake_questions where id = new.question_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Intake question must belong to the same clinic as the intake response';
    end if;
  elsif tg_table_name = 'session_records' then
    select clinic_id into related_clinic_id from public.appointments where id = new.appointment_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Appointment must belong to the same clinic as the session record';
    end if;
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the session record';
    end if;
  elsif tg_table_name = 'follow_ups' then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the follow-up';
    end if;
    if new.appointment_id is not null then
      select clinic_id into related_clinic_id from public.appointments where id = new.appointment_id;
      if related_clinic_id is null or related_clinic_id <> new.clinic_id then
        raise exception 'Appointment must belong to the same clinic as the follow-up';
      end if;
    end if;
  elsif tg_table_name = 'patient_offers' then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the patient offer';
    end if;
    select clinic_id into related_clinic_id from public.monetization_offers where id = new.offer_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Offer must belong to the same clinic as the patient offer';
    end if;
  elsif tg_table_name in ('ai_insights', 'ai_requests') then
    if new.patient_id is not null then
      select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
      if related_clinic_id is null or related_clinic_id <> new.clinic_id then
        raise exception 'Patient must belong to the same clinic as the AI record';
      end if;
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['appointments', 'leads', 'intake_questions', 'intake_responses', 'session_records', 'follow_ups', 'patient_offers', 'ai_insights', 'ai_requests']
  loop
    execute format('drop trigger if exists assert_same_clinic_%s on public.%I', t, t);
    execute format('create trigger assert_same_clinic_%s before insert or update on public.%I for each row execute function public.assert_same_clinic()', t, t);
  end loop;
end $$;

-- 9) Enable RLS for new tables.
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.clinic_users enable row level security;
alter table public.invites enable row level security;
alter table public.feature_flags enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_requests enable row level security;
alter table public.ai_review_status enable row level security;

-- Plans are visible to authenticated users; only platform admins manage them.
drop policy if exists "Authenticated users can view active plans" on public.plans;
create policy "Authenticated users can view active plans"
on public.plans for select to authenticated
using (is_active = true or public.is_platform_staff());

drop policy if exists "Platform admins can manage plans" on public.plans;
create policy "Platform admins can manage plans"
on public.plans for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- Clinic scoped new tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['subscriptions', 'clinic_settings', 'clinic_users', 'invites', 'feature_flags', 'usage_events', 'audit_logs', 'ai_requests', 'ai_review_status']
  loop
    execute format('drop policy if exists "Clinic users can view %s" on public.%I', table_name, table_name);
    execute format('create policy "Clinic users can view %s" on public.%I for select to authenticated using (clinic_id is null or public.can_access_clinic(clinic_id))', table_name, table_name);
  end loop;
end $$;

create policy "Platform admins can manage subscriptions"
on public.subscriptions for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "Clinic managers can manage clinic settings"
on public.clinic_settings for all to authenticated
using (public.can_manage_clinic(clinic_id)) with check (public.can_manage_clinic(clinic_id));

create policy "Clinic managers can manage clinic users"
on public.clinic_users for all to authenticated
using (public.can_manage_clinic(clinic_id)) with check (public.can_manage_clinic(clinic_id));

create policy "Clinic managers can manage invites"
on public.invites for all to authenticated
using (public.can_manage_clinic(clinic_id)) with check (public.can_manage_clinic(clinic_id));

create policy "Platform admins can manage feature flags"
on public.feature_flags for all to authenticated
using (public.is_platform_admin() or public.can_manage_clinic(clinic_id))
with check (public.is_platform_admin() or public.can_manage_clinic(clinic_id));

create policy "Clinic users can create usage events"
on public.usage_events for insert to authenticated
with check (clinic_id is null or public.can_access_clinic(clinic_id));

create policy "Clinic users can create audit logs"
on public.audit_logs for insert to authenticated
with check (clinic_id is null or public.can_access_clinic(clinic_id));

create policy "Clinic users can create AI requests"
on public.ai_requests for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic users can manage AI review status"
on public.ai_review_status for all to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

-- 10) Replace core clinic-owned RLS policies with write permissions and soft-delete visibility.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'patients', 'leads', 'appointments', 'intake_forms', 'intake_questions', 'intake_responses',
        'session_records', 'ai_insights', 'follow_ups', 'monetization_offers', 'patient_offers'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'patients', 'leads', 'appointments', 'intake_forms', 'intake_questions', 'intake_responses',
    'session_records', 'follow_ups', 'monetization_offers', 'patient_offers'
  ]
  loop
    execute format('create policy "Clinic users can view active %s" on public.%I for select to authenticated using (public.can_access_clinic(clinic_id) and deleted_at is null)', t, t);
    execute format('create policy "Clinic users can create %s" on public.%I for insert to authenticated with check (public.can_write_clinic_data(clinic_id))', t, t);
    execute format('create policy "Clinic users can update %s" on public.%I for update to authenticated using (public.can_write_clinic_data(clinic_id) and deleted_at is null) with check (public.can_write_clinic_data(clinic_id))', t, t);
    execute format('create policy "Clinic managers can hard delete %s" on public.%I for delete to authenticated using (public.can_manage_clinic(clinic_id))', t, t);
  end loop;
end $$;

create policy "Clinic users can view active ai_insights"
on public.ai_insights for select to authenticated
using (public.can_access_clinic(clinic_id) and deleted_at is null);

create policy "Clinic users can create ai_insights"
on public.ai_insights for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic managers can hard delete ai_insights"
on public.ai_insights for delete to authenticated
using (public.can_manage_clinic(clinic_id));

-- 11) Audit helper.
create or replace function public.write_audit_log(
  target_clinic_id uuid,
  action_name text,
  entity_name text,
  target_entity_id uuid default null,
  details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if target_clinic_id is not null and not public.can_access_clinic(target_clinic_id) then
    raise exception 'Not allowed to write audit log for this clinic';
  end if;

  insert into public.audit_logs (clinic_id, user_id, action, entity_type, entity_id, metadata)
  values (target_clinic_id, auth.uid(), action_name, entity_name, target_entity_id, details)
  returning id into new_id;

  return new_id;
end;
$$;

-- 12) Seed starter SaaS plans.
insert into public.plans (code, name, description, price_cents, billing_interval, max_users, max_patients, ai_insights_included, features)
values
  ('starter', 'Starter', 'Simple clinic operations for a small team.', 4900, 'monthly', 2, 250, 0, '{"crm": true, "schedule": true, "intake": true}'::jsonb),
  ('professional', 'Professional', 'Full clinic workflow with reports and AI insights.', 14900, 'monthly', null, 2500, 100, '{"crm": true, "schedule": true, "intake": true, "reports": true, "ai_insights": true}'::jsonb),
  ('enterprise', 'Enterprise', 'Advanced controls, custom limits, and compliance support.', 0, 'monthly', null, null, null, '{"custom_branding": true, "audit_logs": true, "feature_flags": true, "priority_support": true}'::jsonb)
on conflict (code) do nothing;

-- Recommended bootstrap after first auth user:
-- update public.users set role = 'platform_admin' where email = 'your-email@example.com';
-- AXIEL Core guided onboarding, generic session setup, working hours, and dashboard AI placeholders.

create table if not exists public.session_types (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  duration_minutes integer not null default 60 check (duration_minutes > 0 and duration_minutes <= 480),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, name)
);

create table if not exists public.working_hours (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  opens_at time not null default '09:00',
  closes_at time not null default '17:00',
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, day_of_week)
);

create index if not exists session_types_clinic_id_idx on public.session_types(clinic_id);
create index if not exists working_hours_clinic_id_idx on public.working_hours(clinic_id);

drop trigger if exists set_session_types_updated_at on public.session_types;
create trigger set_session_types_updated_at
before update on public.session_types
for each row execute function public.set_updated_at();

drop trigger if exists set_working_hours_updated_at on public.working_hours;
create trigger set_working_hours_updated_at
before update on public.working_hours
for each row execute function public.set_updated_at();

alter table public.session_types enable row level security;
alter table public.working_hours enable row level security;

create policy "Clinic users can view session types"
on public.session_types for select to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can manage session types"
on public.session_types for all to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can view working hours"
on public.working_hours for select to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can manage working hours"
on public.working_hours for all to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

-- Let a brand-new authenticated user create their first clinic during guided onboarding.
create policy "Unassigned users can create first clinic during onboarding"
on public.clinics for insert to authenticated
with check (
  not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.clinic_id is not null
  )
);

-- Let that same user attach themselves to the newly created clinic as clinic owner.
create policy "Users can complete own onboarding profile"
on public.users for update to authenticated
using (id = auth.uid() and clinic_id is null)
with check (id = auth.uid() and clinic_id is not null and role in ('clinic_owner', 'staff'));

-- Allow the new clinic owner to create their own clinic_users membership.
create policy "Users can create own clinic owner membership during onboarding"
on public.clinic_users for insert to authenticated
with check (
  user_id = auth.uid()
  and role = 'clinic_owner'
  and public.can_access_clinic(clinic_id)
);
-- AXIEL Core - Action Suggestions
-- Track suggested operational actions that can be accepted, ignored, or completed.

create type public.action_suggestion_status as enum ('pending', 'accepted', 'ignored', 'completed');
create type public.action_suggestion_priority as enum ('high', 'medium', 'low');
create type public.action_suggestion_category as enum ('patient', 'lead', 'schedule', 'follow_up', 'system');
create type public.action_suggestion_source as enum ('system_rule', 'ai_placeholder', 'manual');
create type public.action_suggestion_entity_type as enum ('patient', 'lead', 'appointment', 'follow_up', 'clinic');

create table if not exists public.action_suggestions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  action_key text not null,
  title text not null,
  description text,
  priority public.action_suggestion_priority not null default 'medium',
  category public.action_suggestion_category not null default 'system',
  status public.action_suggestion_status not null default 'pending',
  source public.action_suggestion_source not null default 'system_rule',
  entity_type public.action_suggestion_entity_type,
  entity_id uuid,
  suggested_url text,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  ignored_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, action_key)
);

create index if not exists action_suggestions_clinic_status_idx on public.action_suggestions(clinic_id, status);
create index if not exists action_suggestions_entity_idx on public.action_suggestions(entity_type, entity_id);
create index if not exists action_suggestions_priority_idx on public.action_suggestions(priority);

drop trigger if exists set_action_suggestions_updated_at on public.action_suggestions;
create trigger set_action_suggestions_updated_at
before update on public.action_suggestions
for each row execute function public.set_updated_at();

alter table public.action_suggestions enable row level security;

drop policy if exists "Clinic users can view action suggestions" on public.action_suggestions;
create policy "Clinic users can view action suggestions"
on public.action_suggestions for select to authenticated
using (public.can_access_clinic(clinic_id));

drop policy if exists "Clinic users can create action suggestions" on public.action_suggestions;
create policy "Clinic users can create action suggestions"
on public.action_suggestions for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "Clinic users can update action suggestions" on public.action_suggestions;
create policy "Clinic users can update action suggestions"
on public.action_suggestions for update to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "Clinic managers can delete action suggestions" on public.action_suggestions;
create policy "Clinic managers can delete action suggestions"
on public.action_suggestions for delete to authenticated
using (public.can_manage_clinic(clinic_id));
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
-- AXIEL Core real communications
-- Email via Resend and SMS via Twilio, with simple clinic-customizable templates and message logs.

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  key text not null,
  name text not null,
  channel text not null check (channel in ('email', 'sms')),
  use_case text not null check (use_case in ('appointment_reminder', 'follow_up', 'lead_nurturing')),
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, key)
);

create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  follow_up_id uuid references public.follow_ups(id) on delete set null,
  template_id uuid references public.communication_templates(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  channel text not null check (channel in ('email', 'sms')),
  use_case text not null check (use_case in ('appointment_reminder', 'follow_up', 'lead_nurturing')),
  recipient text not null,
  subject text,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider text check (provider in ('resend', 'twilio')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists communication_templates_clinic_id_idx on public.communication_templates(clinic_id);
create index if not exists communication_templates_use_case_idx on public.communication_templates(use_case);
create index if not exists communication_logs_clinic_id_idx on public.communication_logs(clinic_id);
create index if not exists communication_logs_patient_id_idx on public.communication_logs(patient_id);
create index if not exists communication_logs_lead_id_idx on public.communication_logs(lead_id);
create index if not exists communication_logs_created_at_idx on public.communication_logs(created_at);

-- Keep templates updated cleanly.
drop trigger if exists set_communication_templates_updated_at on public.communication_templates;
create trigger set_communication_templates_updated_at
before update on public.communication_templates
for each row execute function public.set_updated_at();

-- Prevent accidental cross-clinic message logs.
create or replace function public.validate_communication_log_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.patient_id is not null and not exists (
    select 1 from public.patients p where p.id = new.patient_id and p.clinic_id = new.clinic_id
  ) then
    raise exception 'Patient does not belong to this clinic.';
  end if;

  if new.lead_id is not null and not exists (
    select 1 from public.leads l where l.id = new.lead_id and l.clinic_id = new.clinic_id
  ) then
    raise exception 'Lead does not belong to this clinic.';
  end if;

  if new.appointment_id is not null and not exists (
    select 1 from public.appointments a where a.id = new.appointment_id and a.clinic_id = new.clinic_id
  ) then
    raise exception 'Appointment does not belong to this clinic.';
  end if;

  if new.follow_up_id is not null and not exists (
    select 1 from public.follow_ups f where f.id = new.follow_up_id and f.clinic_id = new.clinic_id
  ) then
    raise exception 'Follow-up does not belong to this clinic.';
  end if;

  if new.template_id is not null and not exists (
    select 1 from public.communication_templates t where t.id = new.template_id and t.clinic_id = new.clinic_id
  ) then
    raise exception 'Template does not belong to this clinic.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_communication_log_clinic_trigger on public.communication_logs;
create trigger validate_communication_log_clinic_trigger
before insert or update on public.communication_logs
for each row execute function public.validate_communication_log_clinic();

alter table public.communication_templates enable row level security;
alter table public.communication_logs enable row level security;

create policy "Clinic users can view communication templates"
on public.communication_templates for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create communication templates"
on public.communication_templates for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update communication templates"
on public.communication_templates for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete communication templates"
on public.communication_templates for delete
to authenticated
using (public.is_admin() or (public.current_user_role() = 'clinic_owner' and clinic_id = public.current_user_clinic_id()));

create policy "Clinic users can view communication logs"
on public.communication_logs for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create communication logs"
on public.communication_logs for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update communication logs"
on public.communication_logs for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));


-- 15) AI human validation layer.
-- AXIEL Core AI Human Validation
-- Ensures AI-generated outputs remain drafts/pending review until a human marks them as final.
-- Tracks who approved, when they approved, and any changes/notes made during validation.

-- 1) Add human validation fields to AI insights.
alter table public.ai_insights
  add column if not exists review_status text not null default 'pending_review',
  add column if not exists final_output jsonb,
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists reviewer_notes text,
  add column if not exists changes_made text,
  add column if not exists last_reviewed_by uuid references public.users(id) on delete set null,
  add column if not exists last_reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_insights_review_status_check'
  ) then
    alter table public.ai_insights
      add constraint ai_insights_review_status_check
      check (review_status in ('pending_review', 'needs_changes', 'final', 'archived'));
  end if;
end $$;

-- Existing completed insights become pending review. They are NOT final until approved.
update public.ai_insights
set review_status = 'pending_review'
where review_status is null;

create index if not exists ai_insights_review_status_idx on public.ai_insights(review_status);
create index if not exists ai_insights_approved_at_idx on public.ai_insights(approved_at desc);

-- 2) Create immutable validation history.
create table if not exists public.ai_validation_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  ai_insight_id uuid not null references public.ai_insights(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  action text not null check (action in ('generated_pending_review', 'approved_final', 'requested_changes', 'archived', 'reopened')),
  previous_status text,
  new_status text not null,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewer_notes text,
  changes_made text,
  output_before jsonb,
  output_after jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_validation_events_clinic_id_idx on public.ai_validation_events(clinic_id);
create index if not exists ai_validation_events_ai_insight_id_idx on public.ai_validation_events(ai_insight_id);
create index if not exists ai_validation_events_created_at_idx on public.ai_validation_events(created_at desc);

alter table public.ai_validation_events enable row level security;

-- Drop existing validation policies safely if re-running in staging.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'ai_validation_events'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy "Clinic users can view ai validation events"
on public.ai_validation_events for select to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can insert ai validation events"
on public.ai_validation_events for insert to authenticated
with check (public.can_write_clinic_data(clinic_id));

-- 3) Make validation history immutable. Inserts only.
create or replace function public.prevent_ai_validation_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'AI validation events are immutable and cannot be changed or deleted';
end;
$$;

drop trigger if exists prevent_ai_validation_event_update on public.ai_validation_events;
create trigger prevent_ai_validation_event_update
before update on public.ai_validation_events
for each row execute function public.prevent_ai_validation_event_mutation();

drop trigger if exists prevent_ai_validation_event_delete on public.ai_validation_events;
create trigger prevent_ai_validation_event_delete
before delete on public.ai_validation_events
for each row execute function public.prevent_ai_validation_event_mutation();

-- 4) Track first validation event automatically when an insight is created.
create or replace function public.create_ai_generated_pending_review_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ai_validation_events (
    clinic_id,
    ai_insight_id,
    patient_id,
    action,
    previous_status,
    new_status,
    reviewed_by,
    reviewer_notes,
    changes_made,
    output_after
  ) values (
    new.clinic_id,
    new.id,
    new.patient_id,
    'generated_pending_review',
    null,
    coalesce(new.review_status, 'pending_review'),
    new.created_by,
    'AI output created and waiting for optional human validation before final use.',
    null,
    new.output
  );
  return new;
end;
$$;

drop trigger if exists create_ai_generated_pending_review_event on public.ai_insights;
create trigger create_ai_generated_pending_review_event
after insert on public.ai_insights
for each row execute function public.create_ai_generated_pending_review_event();

-- 5) Extend relationship validation to the new immutable history table.
create or replace function public.validate_ai_validation_event_same_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_clinic_id uuid;
begin
  select clinic_id into related_clinic_id from public.ai_insights where id = new.ai_insight_id;
  if related_clinic_id is null or related_clinic_id <> new.clinic_id then
    raise exception 'AI insight must belong to the same clinic as the validation event';
  end if;

  if new.patient_id is not null then
    select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
    if related_clinic_id is null or related_clinic_id <> new.clinic_id then
      raise exception 'Patient must belong to the same clinic as the validation event';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_clinic_relationship_ai_validation_events on public.ai_validation_events;
create trigger validate_clinic_relationship_ai_validation_events
before insert or update on public.ai_validation_events
for each row execute function public.validate_ai_validation_event_same_clinic();

-- 6) Require final outputs to have human approval metadata.
create or replace function public.validate_ai_final_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.review_status = 'final' then
    if new.approved_by is null or new.approved_at is null or new.final_output is null then
      raise exception 'AI insight cannot be marked final without approved_by, approved_at, and final_output';
    end if;
  end if;

  if old.review_status = 'final' and new.review_status <> 'final' then
    if not public.can_manage_clinic(new.clinic_id) then
      raise exception 'Only clinic managers or owners can reopen a final AI insight';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_ai_final_approval on public.ai_insights;
create trigger validate_ai_final_approval
before update on public.ai_insights
for each row execute function public.validate_ai_final_approval();

-- 7) Keep ai_review_status compatible with older screens while using the stronger status model.
alter table public.ai_review_status
  add column if not exists approved_by uuid references public.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists changes_made text;


-- 016_simple_crm_pipeline_ui
alter table public.leads add column if not exists main_complaint text;
create index if not exists leads_main_complaint_idx on public.leads using gin (to_tsvector('english', coalesce(main_complaint, '')));
-- 017_patient_portal_secure_links
-- Lightweight patient dashboard links with token-based access and immutable access logs.

create table if not exists public.patient_portal_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_portal_access_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  portal_link_id uuid not null references public.patient_portal_links(id) on delete cascade,
  event text not null default 'viewed' check (event in ('viewed', 'expired_or_invalid', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists patient_portal_links_clinic_id_idx on public.patient_portal_links(clinic_id);
create index if not exists patient_portal_links_patient_id_idx on public.patient_portal_links(patient_id);
create index if not exists patient_portal_links_token_hash_idx on public.patient_portal_links(token_hash);
create index if not exists patient_portal_access_logs_clinic_id_idx on public.patient_portal_access_logs(clinic_id);
create index if not exists patient_portal_access_logs_patient_id_idx on public.patient_portal_access_logs(patient_id);

alter table public.patient_portal_links enable row level security;
alter table public.patient_portal_access_logs enable row level security;

create policy "Clinic users can view patient portal links"
on public.patient_portal_links for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create patient portal links"
on public.patient_portal_links for insert
to authenticated
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic users can revoke patient portal links"
on public.patient_portal_links for update
to authenticated
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

create policy "Clinic users can view patient portal access logs"
on public.patient_portal_access_logs for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Service role can insert patient portal access logs"
on public.patient_portal_access_logs for insert
to service_role
with check (true);

create or replace function public.validate_patient_portal_link_same_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_clinic_id uuid;
begin
  select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
  if related_clinic_id is null or related_clinic_id <> new.clinic_id then
    raise exception 'Patient must belong to the same clinic as the patient portal link';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_clinic_relationship_patient_portal_links on public.patient_portal_links;
create trigger validate_clinic_relationship_patient_portal_links
before insert or update on public.patient_portal_links
for each row execute function public.validate_patient_portal_link_same_clinic();

create or replace function public.validate_patient_portal_access_log_same_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_clinic_id uuid;
begin
  select clinic_id into related_clinic_id from public.patients where id = new.patient_id;
  if related_clinic_id is null or related_clinic_id <> new.clinic_id then
    raise exception 'Patient must belong to the same clinic as the patient portal access log';
  end if;

  select clinic_id into related_clinic_id from public.patient_portal_links where id = new.portal_link_id;
  if related_clinic_id is null or related_clinic_id <> new.clinic_id then
    raise exception 'Portal link must belong to the same clinic as the patient portal access log';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_clinic_relationship_patient_portal_access_logs on public.patient_portal_access_logs;
create trigger validate_clinic_relationship_patient_portal_access_logs
before insert
on public.patient_portal_access_logs
for each row execute function public.validate_patient_portal_access_log_same_clinic();

drop trigger if exists set_patient_portal_links_updated_at on public.patient_portal_links;
create trigger set_patient_portal_links_updated_at
before update on public.patient_portal_links
for each row execute function public.set_updated_at();

create or replace function public.prevent_patient_portal_access_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Patient portal access logs are immutable';
end;
$$;

drop trigger if exists prevent_patient_portal_access_log_update on public.patient_portal_access_logs;
create trigger prevent_patient_portal_access_log_update
before update on public.patient_portal_access_logs
for each row execute function public.prevent_patient_portal_access_log_mutation();

drop trigger if exists prevent_patient_portal_access_log_delete on public.patient_portal_access_logs;
create trigger prevent_patient_portal_access_log_delete
before delete on public.patient_portal_access_logs
for each row execute function public.prevent_patient_portal_access_log_mutation();
-- 018_patient_portal_secure_access
-- Hardens patient dashboard links for token-based access, 7-day expiration, regeneration, and HIPAA-friendly audit structure.

alter table public.patient_portal_links
  alter column expires_at set default (now() + interval '7 days');

create index if not exists patient_portal_links_active_idx
on public.patient_portal_links(patient_id, clinic_id, expires_at)
where revoked_at is null;

create index if not exists patient_portal_links_created_by_idx
on public.patient_portal_links(created_by);

create or replace function public.prevent_patient_portal_link_sensitive_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.clinic_id <> new.clinic_id then
    raise exception 'Clinic cannot be changed for patient portal links';
  end if;

  if old.patient_id <> new.patient_id then
    raise exception 'Patient cannot be changed for patient portal links';
  end if;

  if old.token_hash <> new.token_hash then
    raise exception 'Token hash cannot be changed for patient portal links';
  end if;

  if old.expires_at <> new.expires_at then
    raise exception 'Expiration cannot be changed for patient portal links. Regenerate the link instead.';
  end if;

  if old.created_by is distinct from new.created_by then
    raise exception 'Creator cannot be changed for patient portal links';
  end if;

  if old.created_at <> new.created_at then
    raise exception 'Created timestamp cannot be changed for patient portal links';
  end if;

  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'Revoked patient portal links cannot be reactivated. Regenerate the link instead.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_patient_portal_link_sensitive_update on public.patient_portal_links;
create trigger prevent_patient_portal_link_sensitive_update
before update on public.patient_portal_links
for each row execute function public.prevent_patient_portal_link_sensitive_update();

create or replace function public.prevent_patient_portal_link_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Patient portal links cannot be deleted. Revoke the link instead.';
end;
$$;

drop trigger if exists prevent_patient_portal_link_delete on public.patient_portal_links;
create trigger prevent_patient_portal_link_delete
before delete on public.patient_portal_links
for each row execute function public.prevent_patient_portal_link_delete();

create or replace function public.log_patient_portal_link_revoked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.revoked_at is null and new.revoked_at is not null then
    insert into public.patient_portal_access_logs (
      clinic_id,
      patient_id,
      portal_link_id,
      event,
      metadata
    ) values (
      new.clinic_id,
      new.patient_id,
      new.id,
      'revoked',
      jsonb_build_object('reason', 'manual_or_regenerated')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists log_patient_portal_link_revoked on public.patient_portal_links;
create trigger log_patient_portal_link_revoked
after update of revoked_at on public.patient_portal_links
for each row execute function public.log_patient_portal_link_revoked();

create table if not exists public.patient_portal_security_events (
  id uuid primary key default gen_random_uuid(),
  token_hash text,
  event text not null check (event in ('invalid_token', 'expired_token', 'access_denied')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists patient_portal_security_events_token_hash_idx
on public.patient_portal_security_events(token_hash);

alter table public.patient_portal_security_events enable row level security;

create policy "Platform admins can view patient portal security events"
on public.patient_portal_security_events for select
to authenticated
using (public.is_platform_admin());

create policy "Service role can insert patient portal security events"
on public.patient_portal_security_events for insert
to service_role
with check (true);

create or replace function public.prevent_patient_portal_security_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Patient portal security events are immutable';
end;
$$;

drop trigger if exists prevent_patient_portal_security_event_update on public.patient_portal_security_events;
create trigger prevent_patient_portal_security_event_update
before update on public.patient_portal_security_events
for each row execute function public.prevent_patient_portal_security_event_mutation();

drop trigger if exists prevent_patient_portal_security_event_delete on public.patient_portal_security_events;
create trigger prevent_patient_portal_security_event_delete
before delete on public.patient_portal_security_events
for each row execute function public.prevent_patient_portal_security_event_mutation();
