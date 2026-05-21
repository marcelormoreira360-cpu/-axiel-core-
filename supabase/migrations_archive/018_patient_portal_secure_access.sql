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
create or replace trigger prevent_patient_portal_link_sensitive_update
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
create or replace trigger prevent_patient_portal_link_delete
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
create or replace trigger log_patient_portal_link_revoked
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
create or replace trigger prevent_patient_portal_security_event_update
before update on public.patient_portal_security_events
for each row execute function public.prevent_patient_portal_security_event_mutation();

drop trigger if exists prevent_patient_portal_security_event_delete on public.patient_portal_security_events;
create or replace trigger prevent_patient_portal_security_event_delete
before delete on public.patient_portal_security_events
for each row execute function public.prevent_patient_portal_security_event_mutation();
