-- AXIEL Core follow-up system
-- Structured reminders and message placeholders only. No real automation is executed.

do $$ begin
  create type public.follow_up_status as enum ('pending', 'completed', 'canceled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.follow_up_channel as enum ('none', 'email', 'sms');
exception when duplicate_object then null;
end $$;

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  title text not null default 'Next session reminder',
  due_at timestamptz not null,
  status public.follow_up_status not null default 'pending',
  channel public.follow_up_channel not null default 'none',
  message_subject text,
  message_body text,
  notes text,
  ai_suggested_timing text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists follow_ups_clinic_id_idx on public.follow_ups(clinic_id);
create index if not exists follow_ups_patient_id_idx on public.follow_ups(patient_id);
create index if not exists follow_ups_appointment_id_idx on public.follow_ups(appointment_id);
create index if not exists follow_ups_due_at_idx on public.follow_ups(due_at);
create index if not exists follow_ups_status_idx on public.follow_ups(status);

drop trigger if exists set_follow_ups_updated_at on public.follow_ups;
create trigger set_follow_ups_updated_at
before update on public.follow_ups
for each row execute function public.set_updated_at();

alter table public.follow_ups enable row level security;

create policy "Clinic users can view follow ups in their clinic"
on public.follow_ups for select
to authenticated
using (public.can_access_clinic(clinic_id));

create policy "Clinic users can create follow ups in their clinic"
on public.follow_ups for insert
to authenticated
with check (public.can_access_clinic(clinic_id));

create policy "Clinic users can update follow ups in their clinic"
on public.follow_ups for update
to authenticated
using (public.can_access_clinic(clinic_id))
with check (public.can_access_clinic(clinic_id));

create policy "Only admins and clinic owners can delete follow ups"
on public.follow_ups for delete
to authenticated
using (
  public.is_admin()
  or (public.current_user_role() = 'clinic_owner' and clinic_id = public.current_user_clinic_id())
);
