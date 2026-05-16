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
  or (public.current_user_role() = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);
