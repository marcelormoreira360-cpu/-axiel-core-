-- 172: novo status 'in_progress' (em atendimento), entre checked_in e completed.
-- (1) Amplia o CHECK de appointments.status. (2) Inclui 'in_progress' na lista
-- POSITIVA de sessão de pacote consumida, senão a contagem cairia durante o
-- atendimento (checked_in conta, in_progress não contaria, completed volta a contar).
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in (
    'pending','scheduled','confirmed','checked_in','in_progress','completed',
    'no_show','cancelled','cancelled_notice','late_cancel'
  ));

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
          and  coalesce(a.status, 'scheduled') in ('confirmed','checked_in','in_progress','completed')
      ),
      pp.sessions_total
    ),
    updated_at = now()
  where pp.patient_id = v_patient_id
    and pp.clinic_id  = v_clinic_id;

  return null;
end;
$$;
