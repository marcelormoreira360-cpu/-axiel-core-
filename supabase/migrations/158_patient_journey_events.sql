-- Migration 158: patient_journey_events (Frente C, Passo 1)
--
-- Log ÚNICO, datado e append-only da jornada do paciente por clínica. Sustenta a
-- métrica-alvo do piloto: conversão "avaliação concluída" -> "início do plano" em
-- até 45 dias. Hoje a etapa do paciente é CALCULADA em runtime (stage.ts), sem
-- histórico datado; esta tabela guarda O QUANDO de cada marco, barato de consultar.
--
-- Espelha o padrão de segurança JÁ em produção (migration 141,
-- appointment_status_events): escopo por clinic_id, RLS com can_access_clinic para
-- leitura, escrita só via service role (o servidor grava, inclusive em ações do
-- paciente não autenticado), sem UPDATE/DELETE por usuário (append-only). Não
-- reinventa segurança. Idempotente.
--
-- Âncoras da métrica:
--   T0 (avaliação concluída) = appointments.completed_at de uma sessão cujo
--       session_type está marcado is_evaluation (flag adicionada aqui). Sem
--       marcação, não há T0 — a métrica é honesta, sem palpite por nome de serviço.
--   T1 (início do plano)     = o mais cedo entre treatment_plans.started_at e
--       patient_packages.start_date.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Flag estável para identificar a sessão de AVALIAÇÃO por clínica.
--    Nome de tipo de sessão é livre por clínica (e uma clínica pode ter vários
--    tipos "de avaliação"), então uma flag booleana é o marcador confiável de T0.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.session_types
  add column if not exists is_evaluation boolean not null default false;

comment on column public.session_types.is_evaluation is
  'Marca este tipo de sessão como a AVALIAÇÃO inicial (T0 da métrica de conversão da jornada). '
  'Livre por clínica; uma clínica pode marcar mais de um tipo. Default false.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Log append-only da jornada.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.patient_journey_events (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references public.clinics(id) on delete cascade,
  -- patient_id fica null enquanto o registro for de um lead pré-paciente;
  -- lead_id fica null (ou set null) depois que o lead vira paciente.
  patient_id        uuid references public.patients(id) on delete cascade,
  lead_id           uuid references public.leads(id) on delete set null,
  event_type        text not null check (event_type in (
    'lead_created',
    'form_submitted',
    'assessment_scheduled',
    'attended',
    'assessment_completed',   -- T0 da métrica (sessão is_evaluation concluída)
    'report_delivered',
    'plan_presented',
    'plan_started',           -- T1 da métrica (pacote ou plano iniciado)
    'session_completed',
    'follow_up_logged',
    'interrupted',
    'renewed'
  )),
  occurred_at       timestamptz not null,                 -- QUANDO o fato aconteceu (pode ser passado, no import/backfill)
  recorded_at       timestamptz not null default now(),   -- quando o Core registrou
  source            text not null default 'core' check (source in ('core','vagaro_csv','vagaro_api','manual')),
  actor_type        text check (actor_type in ('staff','patient','system')),
  recorded_by_user  uuid references public.users(id) on delete set null,
  ref_table         text,                                 -- ponteiro leve p/ a linha de origem (ex.: 'appointments')
  ref_id            uuid,
  dedup_key         text,                                 -- idempotência (import/backfill/emissor não duplica)
  payload           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

-- Timeline da ficha (por paciente, em ordem cronológica):
create index if not exists patient_journey_events_patient_idx
  on public.patient_journey_events(clinic_id, patient_id, occurred_at);
-- Relatório/métrica (por clínica + tipo + período):
create index if not exists patient_journey_events_type_idx
  on public.patient_journey_events(clinic_id, event_type, occurred_at);
-- Eventos de topo de funil ligados a lead:
create index if not exists patient_journey_events_lead_idx
  on public.patient_journey_events(clinic_id, lead_id)
  where lead_id is not null;
-- Idempotência do emissor/import (dedup_key null é permitido e não conflita):
create unique index if not exists patient_journey_events_dedup_uidx
  on public.patient_journey_events(clinic_id, dedup_key)
  where dedup_key is not null;

alter table public.patient_journey_events enable row level security;

-- Leitura: qualquer usuário da clínica. Escrita: só service role (o serviço grava
-- via admin client). Log append-only: sem policy de UPDATE/DELETE.
drop policy if exists "Clinic users can view journey events" on public.patient_journey_events;
create policy "Clinic users can view journey events"
  on public.patient_journey_events for select to authenticated
  using (public.can_access_clinic(clinic_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Backfill idempotente dos marcos que o Core já conhece (Passo 0: métrica
--    com histórico desde já). Todos com ON CONFLICT DO NOTHING pelo dedup_key,
--    então a migration pode ser reaplicada e os INSERTs podem ser rerodados
--    (ex.: depois de marcar is_evaluation em um tipo, para trazer T0 do passado).
-- ─────────────────────────────────────────────────────────────────────────────

-- 3a. plan_started a partir de patient_packages (start_date).
insert into public.patient_journey_events
  (clinic_id, patient_id, event_type, occurred_at, source, ref_table, ref_id, dedup_key, payload)
select
  pp.clinic_id, pp.patient_id, 'plan_started',
  (pp.start_date::timestamptz), 'core', 'patient_packages', pp.id,
  'core:pkg:' || pp.id || ':plan_started',
  jsonb_build_object('package_name', pp.name)
from public.patient_packages pp
where pp.patient_id is not null
on conflict (clinic_id, dedup_key) where dedup_key is not null do nothing;

-- 3b. plan_started a partir de treatment_plans (started_at). Hoje 0 linhas em
--     prod, mas correto para quando a feature de plano formal for usada.
insert into public.patient_journey_events
  (clinic_id, patient_id, event_type, occurred_at, source, ref_table, ref_id, dedup_key)
select
  tp.clinic_id, tp.patient_id, 'plan_started',
  (tp.started_at::timestamptz), 'core', 'treatment_plans', tp.id,
  'core:tp:' || tp.id || ':plan_started'
from public.treatment_plans tp
where tp.started_at is not null and tp.patient_id is not null
on conflict (clinic_id, dedup_key) where dedup_key is not null do nothing;

-- 3c. assessment_completed (T0) a partir de consultas concluídas cujo tipo é
--     is_evaluation. Sem tipos marcados hoje => 0 linhas (esperado). Rerodável
--     depois que a clínica marcar o(s) tipo(s) de avaliação.
insert into public.patient_journey_events
  (clinic_id, patient_id, event_type, occurred_at, source, ref_table, ref_id, dedup_key)
select
  a.clinic_id, a.patient_id, 'assessment_completed',
  a.completed_at, 'core', 'appointments', a.id,
  'core:appt:' || a.id || ':assessment_completed'
from public.appointments a
join public.session_types st on st.id = a.session_type_id
where a.completed_at is not null
  and a.patient_id is not null
  and st.is_evaluation = true
on conflict (clinic_id, dedup_key) where dedup_key is not null do nothing;

-- 3d. session_completed a partir de todas as consultas concluídas (timeline).
insert into public.patient_journey_events
  (clinic_id, patient_id, event_type, occurred_at, source, ref_table, ref_id, dedup_key)
select
  a.clinic_id, a.patient_id, 'session_completed',
  a.completed_at, 'core', 'appointments', a.id,
  'core:appt:' || a.id || ':session_completed'
from public.appointments a
where a.completed_at is not null and a.patient_id is not null
on conflict (clinic_id, dedup_key) where dedup_key is not null do nothing;

-- 3e. lead_created a partir de leads (topo de funil).
insert into public.patient_journey_events
  (clinic_id, patient_id, lead_id, event_type, occurred_at, source, ref_table, ref_id, dedup_key)
select
  l.clinic_id, l.converted_patient_id, l.id, 'lead_created',
  l.created_at, 'core', 'leads', l.id,
  'core:lead:' || l.id || ':lead_created'
from public.leads l
on conflict (clinic_id, dedup_key) where dedup_key is not null do nothing;

notify pgrst, 'reload schema';
