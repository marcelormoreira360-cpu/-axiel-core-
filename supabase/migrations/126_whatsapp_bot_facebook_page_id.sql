-- 126_whatsapp_bot_facebook_page_id.sql
-- Multi-tenant do Facebook Messenger: mapeia a PÁGINA do Facebook (entry.id do
-- webhook) para a clínica, como já existe para Instagram (meta_instagram_id) e
-- WhatsApp Meta (meta_phone_number_id). Antes, o webhook do Facebook era
-- single-tenant (clinic_id da IFWC cravado), então uma 2ª clínica falaria com a
-- identidade/preços da IFWC. Com esta coluna, cada clínica registra a sua página
-- e o bot resolve a clínica certa (SEC-01).

alter table if exists public.whatsapp_bot_configs
  add column if not exists meta_facebook_page_id text;

create index if not exists whatsapp_bot_configs_meta_facebook_page_id_idx
  on public.whatsapp_bot_configs(meta_facebook_page_id);
