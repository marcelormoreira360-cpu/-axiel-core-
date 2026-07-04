-- 114: passagem de bastão do bot de WhatsApp (Clara).
-- Quando um humano da equipe responde pela UI do Core, a IA para de responder
-- naquela conversa; ela volta por devolução manual ou após 24h de silêncio humano.
--   ai_paused             pausa manual da IA (botão "Pausar IA" na UI de conversas)
--   last_human_message_at momento da última resposta manual da equipe pela UI do Core;
--                         se tiver menos de 24h, o bot conversacional não responde.
-- O gate vale só para a resposta CONVERSACIONAL do bot (webhooks inbound);
-- mensagens transacionais (lembretes, confirmações, NPS) não passam por ele.
alter table public.whatsapp_conversations
  add column if not exists ai_paused boolean not null default false,
  add column if not exists last_human_message_at timestamptz;
