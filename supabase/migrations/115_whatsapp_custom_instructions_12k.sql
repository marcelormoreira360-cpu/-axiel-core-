-- 115: acompanha o fix do app (PR #80) — o prompt operacional da Clara (~8,5k chars)
-- estourava a trava de 3.000 do banco em whatsapp_bot_configs.custom_instructions.
-- (JÁ APLICADA em produção via MCP em 04/07/2026.)
alter table public.whatsapp_bot_configs
  drop constraint if exists whatsapp_bot_configs_custom_instructions_length;
alter table public.whatsapp_bot_configs
  add constraint whatsapp_bot_configs_custom_instructions_length
  check (length(custom_instructions) <= 12000) not valid;
