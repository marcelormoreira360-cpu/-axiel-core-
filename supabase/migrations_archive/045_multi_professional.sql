-- Add display_name, specialty, bio, is_bookable to clinic_users
alter table public.clinic_users
  add column if not exists display_name text,
  add column if not exists specialty    text,
  add column if not exists bio          text,
  add column if not exists is_bookable  boolean not null default false;

-- Add practitioner_id to appointments
alter table public.appointments
  add column if not exists practitioner_id uuid references public.users(id) on delete set null;

create index if not exists appointments_practitioner_id_idx on public.appointments(practitioner_id);

-- Add price_cents and is_online to session_types
alter table public.session_types
  add column if not exists price_cents  integer not null default 0 check (price_cents >= 0),
  add column if not exists is_online    boolean not null default false;
