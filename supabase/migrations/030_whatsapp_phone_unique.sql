-- Add UNIQUE constraint on whatsapp_conversations.phone
-- Prevents duplicate rows per phone that caused race condition in bot webhook:
-- two rapid messages both read empty history, both do INSERT → two rows →
-- maybeSingle() fails → returns empty history → bot restarts conversation.

-- Drop the non-unique index first (will be replaced by unique constraint's implicit index)
drop index if exists public.whatsapp_conversations_phone_idx;

-- Add unique constraint (creates implicit unique index) — idempotent
do $$ begin
  alter table public.whatsapp_conversations
    add constraint whatsapp_conversations_phone_key unique (phone);
exception when duplicate_table then null;
         when others then
           if sqlerrm not like '%already exists%' then raise; end if;
end $$;
