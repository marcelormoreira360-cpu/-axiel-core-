-- =============================================================================
-- 132_channel_consent.sql
-- Opt-in por canal (item 3 do roadmap Fase 1).
--
-- Reaproveita a tabela existente public.patient_consents (migration 045) como
-- log append-only de consentimento por canal de mensagem, usando novos valores
-- de consent_type no formato "channel_<canal>":
--   channel_email | channel_sms | channel_whatsapp | channel_instagram | channel_messenger
--
-- Por que reaproveitar e nao criar tabela nova:
--   - patient_consents ja guarda granted + ip_address + user_agent + source +
--     created_at, que sao exatamente a PROVA de opt-in exigida por TCPA/HIPAA.
--   - O indice idx_patient_consents_patient_id (patient_id, consent_type,
--     created_at DESC) ja serve o lookup "estado atual do canal" (linha mais
--     recente por consent_type). Nenhum indice novo e necessario.
--   - consent_type e TEXT livre; nao ha CHECK a alterar. Nao adicionamos CHECK
--     aqui para nao arriscar rejeitar valores legados ja gravados em producao.
--
-- O ESTADO ATUAL de um canal e a linha mais recente (created_at DESC) daquele
-- consent_type para o paciente: granted=true => opted_in, false => opted_out,
-- ausente => unknown. Ver services/channel-consent-service.ts.
--
-- Migration puramente documental (nao altera schema, nao insere dados).
-- Segura para aplicar a qualquer momento; entra no lote de deploy da Fase 1.
-- =============================================================================

comment on column public.patient_consents.consent_type is
  'Tipo de consentimento. Valores: data_processing | marketing | sharing | portal_access | analytics_anonymized | e opt-in por canal de mensagem no formato channel_<canal> (channel_email|channel_sms|channel_whatsapp|channel_instagram|channel_messenger). O estado atual de um canal e a linha mais recente (created_at DESC) desse consent_type para o paciente.';

notify pgrst, 'reload schema';
