-- Pacotes de sessão por paciente
create table if not exists public.patient_packages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  sessions_total integer not null check (sessions_total > 0),
  start_date date not null default current_date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_packages_patient_id on public.patient_packages(patient_id);

alter table public.patient_packages enable row level security;
create policy "packages_select" on public.patient_packages for select using (public.can_access_clinic(clinic_id));
create policy "packages_insert" on public.patient_packages for insert with check (public.can_write_clinic_data(clinic_id));
create policy "packages_update" on public.patient_packages for update using (public.can_write_clinic_data(clinic_id));
create policy "packages_delete" on public.patient_packages for delete using (public.can_write_clinic_data(clinic_id));
