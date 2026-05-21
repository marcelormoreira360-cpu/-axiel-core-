-- AXIEL Core real communications
-- Email via Resend and SMS via Twilio, with simple clinic-customizable templates and message logs.

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  key text not null,
  name text not null,
  channel text not null check (channel in ('email', 'sms')),
  use_case text not null check (use_case in ('appointment_reminder', 'follow_up', 'lead_nurturing')),
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, key)
);

create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  follow_up_id uuid references public.follow_ups(id) on delete set null,
  template_id uuid references public.communication_templates(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  channel text not null check (channel in ('email', 'sms')),
  use_case text not null check (use_case in ('appointment_reminder', 'follow_up', 'lead_nurturing')),
  recipient text not null,
  subject text,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider text check (provider in ('resend', 'twilio')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists communication_templates_clinic_id_idx on public.communication_templates(clinic_id);
create index if not exists communication_templates_use_case_idx on public.communication_templates(use_case);
create index if not exists communication_logs_clinic_id_idx on public.communication_logs(clinic_id);
create index if not exists communication_logs_patient_id_idx on public.communication_logs(patient_id);
create index if not exists communication_logs_lead_id_idx on public.communication_logs(lead_id);
create index if not exists communication_logs_created_at_idx on public.communication_logs(created_at);

-- Keep templates updated cleanly.
drop trigger if exists set_communication_templates_updated_at on public.communication_templates;
create or replace trigger set_communication_templates_updated_at
before update on public.communication_templates
for each row execute function public.set_updated_at();

-- Prevent accidental cross-clinic message logs.
create or replace function public.validate_communication_log_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.patient_id is not null and not exists (
    select 1 from public.patients p where p.id = new.patient_id and p.clinic_id = new.clinic_id
  ) then
    raise exception 'Patient does not belong to this clinic.';
  end if;

  if new.lead_id is not null and not exists (
    select 1 from public.leads l where l.id = new.lead_id and l.clinic_id = new.clinic_id
  ) then
    raise exception 'Lead does not belong to this clinic.';
  end if;

  if new.appointment_id is not null and not exists (
    select 1 from public.appointments a where a.id = new.appointment_id and a.clinic_id = new.clinic_id
  ) then
    raise exception 'Appointment does not belong to this clinic.';
  end if;

  if new.follow_up_id is not null and not exists (
    select 1 from public.follow_ups f where f.id = new.follow_up_id and f.clinic_id = new.clinic_id
  ) then
    raise exception 'Follow-up does not belong to this clinic.';
  end if;

  if new.template_id is not null and not exists (
    select 1 from public.communication_templates t where t.id = new.template_id and t.clinic_id = new.clinic_id
  ) then
    raise exception 'Template does not belong to this clinic.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_communication_log_clinic_trigger on public.communication_logs;
create or replace trigger validate_communication_log_clinic_trigger
before insert or update on public.communication_logs
for each row execute function public.validate_communication_log_clinic();

alter table public.communication_templates enable row level security;
alter table public.communication_logs enable row level security;

create policy "Clinic users can view communication templates"
on public.communication_templates for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create communication templates"
on public.communication_templates for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update communication templates"
on public.communication_templates for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete communication templates"
on public.communication_templates for delete
to authenticated
using (public.is_admin() or (public.current_user_role() = 'clinic_owner' and clinic_id = public.current_user_clinic_id()));

create policy "Clinic users can view communication logs"
on public.communication_logs for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create communication logs"
on public.communication_logs for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update communication logs"
on public.communication_logs for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));
