alter table public.whatsapp_conversations
  add column if not exists current_step integer not null default 1;
