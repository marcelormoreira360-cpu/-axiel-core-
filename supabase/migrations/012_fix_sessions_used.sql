-- ============================================================
-- Migration 012 — Fix sessions_used (B-01 + A-02)
--
-- Problems fixed:
--   B-01: sessions_used column always stayed 0 — never updated
--         after appointment creation/cancellation
--   A-02: cancelled/no_show appointments were counted as used
--
-- Approach:
--   1. Add `status` column to appointments (exists on remote
--      but was missing from migrations)
--   2. Create AFTER trigger on appointments to recalculate
--      sessions_used for all packages of the affected patient
--   3. Backfill existing packages with the correct count
-- ============================================================

-- ── 0. Add columns to patient_packages if not present ──────────────
alter table public.patient_packages
  add column if not exists sessions_used integer not null default 0;
alter table public.patient_packages
  add column if not exists updated_at timestamptz;

-- Add check constraint idempotently
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'patient_packages_sessions_used_check'
      and conrelid = 'public.patient_packages'::regclass
  ) then
    alter table public.patient_packages
      add constraint patient_packages_sessions_used_check
      check (sessions_used >= 0);
  end if;
end $$;

-- ── 1. Add status column to appointments if not already present ──
alter table public.appointments
  add column if not exists status text default 'scheduled';

-- Add check constraint separately (idempotent via DO block)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_status_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_status_check
      check (status in ('scheduled','confirmed','completed','cancelled','no_show'));
  end if;
end $$;

-- ── 2. Trigger function ──────────────────────────────────────────
create or replace function public.sync_package_sessions_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient_id uuid;
  v_clinic_id  uuid;
begin
  -- Determine the affected patient/clinic (handle DELETE separately)
  if (TG_OP = 'DELETE') then
    v_patient_id := OLD.patient_id;
    v_clinic_id  := OLD.clinic_id;
  else
    v_patient_id := NEW.patient_id;
    v_clinic_id  := NEW.clinic_id;
  end if;

  -- Recalculate sessions_used for every package of this patient/clinic.
  -- Only count non-cancelled, non-no_show appointments that fall on or
  -- after the package start date.  Cap at sessions_total to satisfy the
  -- existing CHECK constraint.
  update public.patient_packages pp
  set
    sessions_used = least(
      (
        select count(*)::integer
        from   public.appointments a
        where  a.patient_id = pp.patient_id
          and  a.clinic_id  = pp.clinic_id
          and  a.starts_at >= (pp.start_date || 'T00:00:00')::timestamptz
          and  coalesce(a.status, 'scheduled') not in ('cancelled', 'no_show')
      ),
      pp.sessions_total
    ),
    updated_at = now()
  where pp.patient_id = v_patient_id
    and pp.clinic_id  = v_clinic_id;

  return null; -- AFTER trigger: return value is ignored
end;
$$;

-- ── 3. Attach trigger ────────────────────────────────────────────
drop trigger if exists trg_sync_package_sessions on public.appointments;
create trigger trg_sync_package_sessions
  after insert or update or delete
  on public.appointments
  for each row
  execute function public.sync_package_sessions_used();

-- ── 4. Backfill all existing packages with the correct count ─────
update public.patient_packages pp
set
  sessions_used = least(
    (
      select count(*)::integer
      from   public.appointments a
      where  a.patient_id = pp.patient_id
        and  a.clinic_id  = pp.clinic_id
        and  a.starts_at >= (pp.start_date || 'T00:00:00')::timestamptz
        and  coalesce(a.status, 'scheduled') not in ('cancelled', 'no_show')
    ),
    pp.sessions_total
  ),
  updated_at = now();
