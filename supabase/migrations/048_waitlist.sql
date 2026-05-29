-- ============================================================
-- Migration 048 — Waitlist (Fila de espera)
--
-- Patients who want to be notified when a cancellation opens
-- up a slot. Entries are per-clinic; optionally filtered by
-- session_type or practitioner.
-- ============================================================

create table if not exists public.waitlist_entries (
  id              uuid        primary key default gen_random_uuid(),
  clinic_id       uuid        not null references public.clinics(id)   on delete cascade,
  patient_id      uuid        not null references public.patients(id)  on delete cascade,
  session_type_id uuid        references public.session_types(id)      on delete set null,
  notes           text,
  status          text        not null default 'waiting'
                              check (status in ('waiting','notified','booked','expired','removed')),
  notified_at     timestamptz,
  created_at      timestamptz not null default now(),

  -- Prevent duplicate active entries per patient per clinic
  unique (clinic_id, patient_id, status)
    deferrable initially deferred
);

create index if not exists waitlist_entries_clinic_status_idx
  on public.waitlist_entries (clinic_id, status, created_at asc);

create index if not exists waitlist_entries_patient_idx
  on public.waitlist_entries (patient_id);

alter table public.waitlist_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'waitlist_entries'
      and policyname = 'Clinic members can manage waitlist_entries'
  ) then
    execute $policy$
      create policy "Clinic members can manage waitlist_entries"
        on public.waitlist_entries
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
