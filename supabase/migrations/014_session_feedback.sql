-- ============================================================
-- Migration 014 — Session feedback / NPS
--
-- Creates the session_feedback table for storing post-session
-- NPS scores (0-10) and optional written feedback from patients.
-- Each appointment can have at most one feedback row (UNIQUE).
-- ============================================================

create table if not exists public.session_feedback (
  id             uuid        primary key default gen_random_uuid(),
  clinic_id      uuid        not null references public.clinics(id)      on delete cascade,
  patient_id     uuid        not null references public.patients(id)     on delete cascade,
  appointment_id uuid        not null references public.appointments(id) on delete cascade,
  nps_score      integer     not null check (nps_score >= 0 and nps_score <= 10),
  feedback_text  text,
  created_at     timestamptz not null default now(),

  -- one feedback entry per appointment
  unique (appointment_id)
);

-- Indexes for common query patterns
create index if not exists session_feedback_clinic_patient_idx
  on public.session_feedback (clinic_id, patient_id);

create index if not exists session_feedback_clinic_created_idx
  on public.session_feedback (clinic_id, created_at desc);

-- RLS: clinic members can read/manage their own feedback
alter table public.session_feedback enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'session_feedback'
      and policyname = 'Clinic members can manage session_feedback'
  ) then
    execute $policy$
      create policy "Clinic members can manage session_feedback"
        on public.session_feedback
        for all
        using (
          clinic_id in (
            select clinic_id from public.clinic_users
            where user_id = auth.uid() and status = 'active'
          )
        )
    $policy$;
  end if;
end $$;
