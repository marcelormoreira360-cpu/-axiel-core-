-- SEC-02: Add meta_phone_number_id to whatsapp_bot_configs so the Meta
-- webhook can resolve clinic_id from the incoming phone_number_id.
-- Each clinic configures their Meta Phone Number ID in Settings → WhatsApp Bot.

alter table public.whatsapp_bot_configs
  add column if not exists meta_phone_number_id text unique;

-- Index for fast lookup in the webhook hot path
create index if not exists whatsapp_bot_configs_meta_phone_idx
  on public.whatsapp_bot_configs (meta_phone_number_id)
  where meta_phone_number_id is not null;
