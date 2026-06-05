-- migration 055_appointments_status_recover.sql
-- CORREÇÃO DE PRODUÇÃO: a migration 012 consta como "aplicada" no registro do
-- Supabase, mas seus efeitos NÃO existem no banco real (sem coluna
-- appointments.status, sem constraint, sem a função/trigger de sessions_used).
-- ~15 pontos do código filtram/escrevem appointments.status → erro 42703
-- (quebra /financeiro, dashboard, relatórios de profissional, booking, etc.).
-- Esta migration re-aplica fielmente as partes faltantes da 012. Idempotente.

-- 1. Coluna status (default 'scheduled') + CHECK
alter table public.appointments
  add column if not exists status text default 'scheduled';

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

-- 1b. patient_packages.updated_at (faltava em produção — usado pelo trigger abaixo)
alter table public.patient_packages
  add column if not exists updated_at timestamptz not null default now();

-- 2. Função que mantém patient_packages.sessions_used em sincronia
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
  if (TG_OP = 'DELETE') then
    v_patient_id := OLD.patient_id;
    v_clinic_id  := OLD.clinic_id;
  else
    v_patient_id := NEW.patient_id;
    v_clinic_id  := NEW.clinic_id;
  end if;

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

  return null;
end;
$$;

-- 3. Anexar o trigger
drop trigger if exists trg_sync_package_sessions on public.appointments;
create trigger trg_sync_package_sessions
  after insert or update or delete
  on public.appointments
  for each row
  execute function public.sync_package_sessions_used();

-- 4. Backfill de sessions_used em todos os pacotes
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

notify pgrst, 'reload schema';
