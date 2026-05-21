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
create or replace trigger validate_clinic_relationship_patient_portal_links
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
create or replace trigger validate_clinic_relationship_patient_portal_access_logs
before insert
on public.patient_portal_access_logs
for each row execute function public.validate_patient_portal_access_log_same_clinic();

drop trigger if exists set_patient_portal_links_updated_at on public.patient_portal_links;
create or replace trigger set_patient_portal_links_updated_at
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
create or replace trigger prevent_patient_portal_access_log_update
before update on public.patient_portal_access_logs
for each row execute function public.prevent_patient_portal_access_log_mutation();

drop trigger if exists prevent_patient_portal_access_log_delete on public.patient_portal_access_logs;
create or replace trigger prevent_patient_portal_access_log_delete
before delete on public.patient_portal_access_logs
for each row execute function public.prevent_patient_portal_access_log_mutation();
