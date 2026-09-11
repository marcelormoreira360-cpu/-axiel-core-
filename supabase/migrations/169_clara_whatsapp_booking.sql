-- 169: F1 — Clara agenda de verdade no WhatsApp.
-- Adiciona a capacidade (por clínica) de a Clara OFERECER horários reais da
-- Avaliação Inicial e AGENDAR o horário escolhido pelo paciente pelo webhook do
-- WhatsApp, em vez de só criar lead + mandar link. Multi-clínica: desligado por
-- padrão, ligado só na IFWC (piloto).
--
-- 1) whatsapp_bot_configs.booking_enabled — capability por clínica (default false).
-- 2) whatsapp_conversations.booking_state — estado do mini-fluxo de agendamento
--    (preferência de período, horários oferecidos, nome, slug, session_type_id).

alter table public.whatsapp_bot_configs
  add column if not exists booking_enabled boolean not null default false;

alter table public.whatsapp_conversations
  add column if not exists booking_state jsonb;

-- IFWC piloto — liga a capability só nesta clínica.
update public.whatsapp_bot_configs
  set booking_enabled = true
  where clinic_id = '98e98ef3-a056-40bd-989b-0ab69d0c4bff';
