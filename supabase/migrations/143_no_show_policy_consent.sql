-- =============================================================================
-- 143_no_show_policy_consent.sql
-- Gate de consentimento da política de no-show / cancelamento tardio.
--
-- Ver COMPLIANCE_Aceite_Politica_NoShow.md (Lex) e POLITICA_Taxa_NoShow_LateCancel.md (Cobro).
--
-- Esta migration é o "Opção A" do Lex (seção 3.3): reaproveitar a tabela
-- append-only public.patient_consents (migration 045) para o novo
-- consent_type='no_show_policy', adicionando SÓ o que falta para a defensabilidade:
--   1. policy_version  -> qual versão do texto o paciente aceitou (prova).
--   2. appointment_id  -> liga o aceite ao agendamento que pode gerar a taxa.
--
-- NADA aqui habilita cobrança real. É só captura e registro do aceite. A cobrança
-- ao paciente continua TRAVADA (Fase 2, migration 142) até aprovação do texto por
-- Marcelo + validação de advogado humano.
--
-- Aditiva, idempotente (add column if not exists), colunas nullable — não quebra os
-- usos atuais de patient_consents (LGPD 045, opt-in por canal 132). RLS já existe na
-- tabela (staff lê a própria clínica; service role full access); nada muda de RLS.
-- =============================================================================

-- 1. Versão do texto aceito. String estável (ex.: 'no_show_v1.0'); o texto de cada
--    versão fica arquivado e imutável no repo (modules/no-show-policy/policy-text.ts),
--    recuperável exatamente pela policy_version.
alter table public.patient_consents
  add column if not exists policy_version text;

-- 2. Vínculo ao agendamento que originou o aceite. on delete set null: se o
--    agendamento for apagado, o registro de aceite (prova) sobrevive.
alter table public.patient_consents
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

comment on column public.patient_consents.policy_version is
  'Versao do texto de politica aceito (ex.: no_show_v1.0). So preenchido para consent_type que sao versionados (no_show_policy). O texto da versao fica arquivado no repo, recuperavel pela string.';

comment on column public.patient_consents.appointment_id is
  'Agendamento que originou este aceite (usado por no_show_policy para ligar o consentimento ao appointment que pode gerar taxa). null para consentimentos nao ligados a agendamento (LGPD, canais).';

-- Atualiza o comentario do consent_type para incluir o novo valor no_show_policy.
-- (Segue o padrao da migration 132: consent_type e TEXT livre, sem CHECK, para nao
-- rejeitar valores legados ja gravados em producao.)
comment on column public.patient_consents.consent_type is
  'Tipo de consentimento. Valores: data_processing | marketing | sharing | portal_access | analytics_anonymized | no_show_policy (aceite da politica de falta/cancelamento tardio, com policy_version + appointment_id) | e opt-in por canal de mensagem no formato channel_<canal>. O estado atual de um consentimento e a linha mais recente (created_at DESC) desse consent_type para o paciente.';

-- Lookup por agendamento (a fila de decisao de taxa checa "existe aceite para este
-- appointment?"). Parcial: so as linhas de aceite de politica com appointment.
create index if not exists idx_patient_consents_no_show_appt
  on public.patient_consents (appointment_id)
  where consent_type = 'no_show_policy' and appointment_id is not null;

notify pgrst, 'reload schema';
