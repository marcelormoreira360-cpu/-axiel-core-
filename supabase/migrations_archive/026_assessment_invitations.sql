create table if not exists public.assessment_invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,       -- sha256 of raw token (never store raw)
  template_id uuid not null references public.assessment_templates(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '15 days'),
  completed_at timestamptz,
  response_id uuid references public.assessment_responses(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_assessment_invitations_token_hash on public.assessment_invitations(token_hash);
create index if not exists idx_assessment_invitations_patient_id on public.assessment_invitations(patient_id);

-- No RLS needed — accessed only via service role key or specific functions
alter table public.assessment_invitations enable row level security;

-- Clinic users can view their own invitations
create policy "assessment_invitations_select" on public.assessment_invitations
  for select using (public.can_access_clinic(clinic_id));

create policy "assessment_invitations_insert" on public.assessment_invitations
  for insert with check (public.can_write_clinic_data(clinic_id));

create policy "assessment_invitations_update" on public.assessment_invitations
  for update using (public.can_write_clinic_data(clinic_id));
