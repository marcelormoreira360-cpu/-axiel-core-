-- ============================================================
-- Migration 015 — Portal messages (async chat)
--
-- Enables asynchronous messaging between clinic staff and
-- patients via the patient portal. Each row is one message.
-- ============================================================

create table if not exists public.portal_messages (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id)   on delete cascade,
  patient_id  uuid        not null references public.patients(id)  on delete cascade,
  direction   text        not null check (direction in ('clinic_to_patient', 'patient_to_clinic')),
  body        text        not null check (char_length(body) between 1 and 2000),
  read_at     timestamptz,                         -- null = unread by the other party
  created_by  uuid        references public.users(id) on delete set null,  -- null = patient
  created_at  timestamptz not null default now()
);

-- Fetch conversation for a patient/clinic pair
create index if not exists portal_messages_conversation_idx
  on public.portal_messages (clinic_id, patient_id, created_at asc);

-- Quickly count unread patient → clinic messages
create index if not exists portal_messages_unread_idx
  on public.portal_messages (clinic_id, patient_id, direction, read_at)
  where read_at is null;

-- RLS: only authenticated clinic members can access messages
alter table public.portal_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'portal_messages'
      and policyname = 'Clinic members can manage portal_messages'
  ) then
    execute $policy$
      create policy "Clinic members can manage portal_messages"
        on public.portal_messages
        for all
        using (
          clinic_id in (
            select clinic_id from public.clinic_users
            where user_id = auth.uid() and status = 'active'
          )
        )
    $policy$;
  end if;
end $$;
