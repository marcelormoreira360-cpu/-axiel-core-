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
create or replace trigger set_session_types_updated_at
before update on public.session_types
for each row execute function public.set_updated_at();

drop trigger if exists set_working_hours_updated_at on public.working_hours;
create or replace trigger set_working_hours_updated_at
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
