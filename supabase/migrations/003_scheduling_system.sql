-- AXIEL Core scheduling module
-- Adds generic appointments/sessions with clinic-level isolation.

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

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;

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
    public.current_user_role() = 'clinic_owner'
    and clinic_id = public.current_user_clinic_id()
  )
);
