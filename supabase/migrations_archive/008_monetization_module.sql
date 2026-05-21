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
create or replace trigger set_monetization_offers_updated_at
before update on public.monetization_offers
for each row execute function public.set_updated_at();

drop trigger if exists set_patient_offers_updated_at on public.patient_offers;
create or replace trigger set_patient_offers_updated_at
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
  or (public.current_user_role() = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
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
  or (public.current_user_role() = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);
