-- Migration 142: decisão humana de taxa (no-show / cancelamento tardio) + flag de retenção.
--
-- Ver TICKET_Status_Agendamento_Fase2.md e POLITICA_Taxa_NoShow_LateCancel.md.
-- A Fase 1 (migration 141) já emite os eventos no outbox appointment_lifecycle_events
-- (event_type 'fee_decision_pending' e 'repeated_no_show'). Esta migration é 100% do
-- lado consumidor: NENHUMA cobrança automática. A taxa só vira recebível quando a
-- equipe (Marcelo/Dayane) decide "Cobrar". O disparo real da cobrança ao paciente é do
-- fluxo do Cobro e depende do gate de consentimento (Lex). Nada é debitado aqui.
--
-- Escopo:
--   1. Config de taxa POR CLÍNICA em public.clinics (colunas, defaults = seed do Cobro).
--      Cada clínica sobrescreve ou desliga (mode='none'). Nada de valor fixo no código.
--   2. Tabela public.appointment_fee_decisions (pendência de decisão, 1 por appointment),
--      idempotente por appointment_id, RLS por clinic_id.
--   3. Coluna public.patients.retention_risk_flagged_at (flag de retenção, Fase 2C).
--
-- Multi-tenant: tudo escopado por clinic_id, RLS com can_access_clinic. Idempotente.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Config de taxa por clínica (colunas em public.clinics). Os DEFAULTS abaixo são
--    o SEED sugerido pelo Cobro (POLITICA_Taxa_NoShow_LateCancel.md): cada clínica
--    nasce com a política, mas pode sobrescrever ou zerar (mode='none'). O cálculo do
--    valor sugerido (services/fee-decision-service.ts) SEMPRE lê destas colunas; nunca
--    há valor de taxa constante no código.
--
--    Moeda: NÃO se cria coluna de moeda aqui. A taxa é cobrança AO PACIENTE, então a
--    moeda é clinic_settings.default_currency (getClinicCurrency). Os pisos/tetos do
--    Cobro estão em US$; para clínica em BRL/EUR o seed usa o mesmo número na moeda
--    local (piso/teto são política, não câmbio) e a clínica ajusta se quiser.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.clinics
  -- No-show
  add column if not exists no_show_fee_mode        text    not null default 'percent'
    check (no_show_fee_mode in ('percent','fixed','none')),
  add column if not exists no_show_fee_percent      integer not null default 50,     -- 50% do serviço
  add column if not exists no_show_fee_min_cents    integer not null default 5000,   -- piso US$50 (tb valor no modo 'fixed')
  add column if not exists no_show_fee_max_cents    integer not null default 15000,  -- teto US$150
  -- Late cancel
  add column if not exists late_cancel_fee_mode     text    not null default 'percent'
    check (late_cancel_fee_mode in ('percent','fixed','none')),
  add column if not exists late_cancel_fee_percent   integer not null default 25,    -- 25% do serviço
  add column if not exists late_cancel_fee_min_cents integer not null default 2500,  -- piso US$25 (tb valor no modo 'fixed')
  add column if not exists late_cancel_fee_max_cents integer not null default 7500,  -- teto US$75
  -- Cortesia na 1a falta/cancelamento tardio do paciente (sugere 0 na 1a ocorrência)
  add column if not exists first_miss_courtesy       boolean not null default true;

comment on column public.clinics.no_show_fee_mode is
  'Como sugerir a taxa de no-show: percent (percentual de session_types.price_cents com piso/teto), fixed (valor fixo em no_show_fee_min_cents) ou none (clinica nao cobra falta). Seed do Cobro; a clinica pode sobrescrever.';
comment on column public.clinics.late_cancel_fee_mode is
  'Idem para cancelamento tardio. none = clinica nao cobra cancelamento tardio.';
comment on column public.clinics.first_miss_courtesy is
  'Se true, a 1a falta/cancelamento tardio do paciente entra como cortesia (valor sugerido zero); a partir da 2a aplica a regra normal.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Pendência de decisão de taxa (uma por appointment). O consumidor materializa
--    aqui cada evento 'fee_decision_pending'. Máquina de estados:
--      pendente_decisao -> cobrar    (grava amount_cents, cria vínculo financeiro)
--      pendente_decisao -> dispensar (não cria recebível)
--    amount_cents nasce null: o valor SUGERIDO é calculado na leitura a partir da
--    config da clínica; só é gravado firme quando a equipe decide "Cobrar".
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.appointment_fee_decisions (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references public.clinics(id) on delete cascade,
  appointment_id     uuid not null references public.appointments(id) on delete cascade,
  patient_id         uuid not null references public.patients(id) on delete cascade,
  trigger_status     text not null check (trigger_status in ('late_cancel','no_show')),
  state              text not null default 'pendente_decisao'
                       check (state in ('pendente_decisao','cobrar','dispensar')),
  amount_cents       integer check (amount_cents is null or amount_cents >= 0), -- null até decidir Cobrar
  currency           text not null,                    -- congela a moeda do paciente na materialização
  decided_by_user    uuid references public.users(id) on delete set null,
  decided_at         timestamptz,
  notes              text,                             -- motivo do dispensar / observação do cobrar
  patient_payment_id uuid references public.patient_payments(id) on delete set null, -- vínculo do handoff (2B)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- IDEMPOTÊNCIA: no máximo uma pendência por appointment. O consumidor faz
-- insert ... on conflict (appointment_id) do nothing.
create unique index if not exists appt_fee_decisions_appt_uidx
  on public.appointment_fee_decisions(appointment_id);

create index if not exists appt_fee_decisions_clinic_state_idx
  on public.appointment_fee_decisions(clinic_id, state);
create index if not exists appt_fee_decisions_pending_idx
  on public.appointment_fee_decisions(clinic_id)
  where state = 'pendente_decisao';

alter table public.appointment_fee_decisions enable row level security;

-- Leitura: usuários da clínica (o gate por papel financeiro fica na camada de app,
-- via requireFinanceAccess, como nas demais telas do financeiro). A RLS garante o
-- isolamento multi-tenant. Escrita/edição: só o service role (server actions com
-- admin client), igual ao padrão do outbox da Fase 1.
drop policy if exists "Clinic users can view fee decisions" on public.appointment_fee_decisions;
create policy "Clinic users can view fee decisions"
  on public.appointment_fee_decisions for select to authenticated
  using (public.can_access_clinic(clinic_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Flag de retenção (Fase 2C): setada quando chega o evento 'repeated_no_show'.
--    Aparece direto no perfil do paciente; sem tabela nova (Opção 1 do ticket).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.patients
  add column if not exists retention_risk_flagged_at timestamptz;

comment on column public.patients.retention_risk_flagged_at is
  'Quando o paciente foi sinalizado como risco de retenção (faltas repetidas, evento repeated_no_show). Interno; nunca exposto ao paciente. null = sem flag.';

notify pgrst, 'reload schema';
