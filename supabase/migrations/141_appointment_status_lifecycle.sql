-- Migration 141: ciclo de status do agendamento + self-service do paciente (Fase 1)
--
-- Ver TICKET_Status_Agendamento_SelfService.md. Escopo desta migration:
--   1. Ampliar o CHECK de appointments.status com os status novos de negócio
--      (checked_in, cancelled_notice, late_cancel); manter 'cancelled' legado.
--   2. clinics.cancellation_window_hours (janela que separa cancelamento com
--      aviso de cancelamento tardio), default 24h, configurável por clínica.
--   3. Carimbos de conveniência em appointments (checked_in_at, completed_at,
--      cancelled_at, cancelled_by_role). A fonte de verdade é o log em (4).
--   4. appointment_status_events: log append-only de toda mudança de status,
--      com RLS por clinic_id. Base do relatório e prova em disputa de cobrança.
--   5. appointment_lifecycle_events: outbox append-only para os HOOKS da Fase 2
--      (taxa a decidir / flag de retenção). Só registra o evento; NENHUMA lógica
--      de cobrança aqui. A Fase 2 liga os consumidores lendo desta tabela.
--   6. sync_package_sessions_used: contar como sessão consumida apenas
--      confirmed/checked_in/completed (lista POSITIVA).
--
-- Multi-tenant: tudo escopado por clinic_id, RLS com can_access_clinic /
-- can_write_clinic_data. Idempotente.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ampliar o CHECK de status. 'cancelled' fica só como legado; fluxos novos
--    gravam cancelled_notice ou late_cancel.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in (
    'pending','scheduled','confirmed','checked_in','completed',
    'no_show','cancelled','cancelled_notice','late_cancel'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Janela de cancelamento por clínica (horas antes de starts_at).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.clinics
  add column if not exists cancellation_window_hours integer not null default 24;

comment on column public.clinics.cancellation_window_hours is
  'Janela (horas antes de starts_at) que separa cancelamento com aviso de cancelamento tardio. Default 24.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Carimbos de conveniência (o log em 4 é a fonte de verdade). confirmed_at
--    já existe (migration 078).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.appointments
  add column if not exists checked_in_at     timestamptz,
  add column if not exists completed_at       timestamptz,
  add column if not exists cancelled_at        timestamptz,
  add column if not exists cancelled_by_role   text;  -- 'staff' | 'patient' | 'system'

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Log de auditoria de status (append-only, fonte de verdade do relatório).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.appointment_status_events (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references public.clinics(id) on delete cascade,
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  from_status     text,                         -- null na criação
  to_status       text not null,
  changed_by_user uuid references public.users(id) on delete set null, -- null se paciente/sistema
  actor_type      text not null check (actor_type in ('staff','patient','system')),
  reason          text,
  created_at      timestamptz not null default now()
);

create index if not exists appt_status_events_appt_idx    on public.appointment_status_events(appointment_id);
create index if not exists appt_status_events_clinic_idx  on public.appointment_status_events(clinic_id);
create index if not exists appt_status_events_created_idx on public.appointment_status_events(created_at);
-- Consulta do relatório (por clínica + período + status final):
create index if not exists appt_status_events_clinic_to_created_idx
  on public.appointment_status_events(clinic_id, to_status, created_at);

alter table public.appointment_status_events enable row level security;

-- Leitura: qualquer usuário da clínica. Escrita/edição: só service role (o
-- serviço/servidor grava via admin client, inclusive na ação do paciente, que
-- não é usuário autenticado). Log append-only: sem update/delete por usuário.
drop policy if exists "Clinic users can view status events" on public.appointment_status_events;
create policy "Clinic users can view status events"
  on public.appointment_status_events for select to authenticated
  using (public.can_access_clinic(clinic_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Outbox dos hooks da Fase 2 (append-only). Só REGISTRA o evento; a lógica de
--    cobrança/retenção é da Fase 2 e lê desta tabela. Nada é debitado aqui.
--      event_type = 'fee_decision_pending'  -> late_cancel | no_show (taxa a decidir)
--      event_type = 'repeated_no_show'      -> paciente atingiu 2+ no_show
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.appointment_lifecycle_events (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null references public.clinics(id) on delete cascade,
  appointment_id  uuid references public.appointments(id) on delete cascade,
  patient_id      uuid references public.patients(id) on delete cascade,
  event_type      text not null check (event_type in ('fee_decision_pending','repeated_no_show')),
  trigger_status  text,                       -- 'late_cancel' | 'no_show' quando aplicável
  payload         jsonb not null default '{}'::jsonb,
  consumed_at     timestamptz,                -- null = ainda não processado pela Fase 2
  created_at      timestamptz not null default now()
);

create index if not exists appt_lifecycle_events_clinic_idx    on public.appointment_lifecycle_events(clinic_id);
create index if not exists appt_lifecycle_events_unconsumed_idx on public.appointment_lifecycle_events(clinic_id, event_type) where consumed_at is null;

alter table public.appointment_lifecycle_events enable row level security;

drop policy if exists "Clinic users can view lifecycle events" on public.appointment_lifecycle_events;
create policy "Clinic users can view lifecycle events"
  on public.appointment_lifecycle_events for select to authenticated
  using (public.can_access_clinic(clinic_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. sync_package_sessions_used: só confirmed/checked_in/completed consomem
--    sessão do pacote. Lista POSITIVA (mais segura que exclusão): qualquer
--    status novo que não esteja aqui, por padrão, NÃO consome.
-- ─────────────────────────────────────────────────────────────────────────────
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
          and  coalesce(a.status, 'scheduled') in ('confirmed','checked_in','completed')
      ),
      pp.sessions_total
    ),
    updated_at = now()
  where pp.patient_id = v_patient_id
    and pp.clinic_id  = v_clinic_id;

  return null;
end;
$$;

-- Backfill: recalcula sessions_used de todos os pacotes com a nova regra.
update public.patient_packages pp
set
  sessions_used = least(
    (
      select count(*)::integer
      from   public.appointments a
      where  a.patient_id = pp.patient_id
        and  a.clinic_id  = pp.clinic_id
        and  a.starts_at >= (pp.start_date || 'T00:00:00')::timestamptz
        and  coalesce(a.status, 'scheduled') in ('confirmed','checked_in','completed')
    ),
    pp.sessions_total
  ),
  updated_at = now();

notify pgrst, 'reload schema';
