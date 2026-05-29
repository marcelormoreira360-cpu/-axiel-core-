-- Migration 035: Safety-net fixes for WhatsApp tables
-- Applied manually via SQL Editor on 2026-05-28 to fix production DB that was
-- created without all constraints/columns from earlier migrations (005, 030, 031).
--
-- All statements use IF NOT EXISTS / DO blocks so they are idempotent and safe
-- to run on both fresh installs and the production DB.

-- ── 1. whatsapp_bot_configs: enforce UNIQUE on clinic_id ─────────────────────
-- Migration 005 defines clinic_id as UNIQUE inline, but production DB was
-- missing this constraint, causing ON CONFLICT (clinic_id) to fail (42P10).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.whatsapp_bot_configs'::regclass
      and contype = 'u'
      and conname = 'whatsapp_bot_configs_clinic_id_key'
  ) then
    alter table public.whatsapp_bot_configs
      add constraint whatsapp_bot_configs_clinic_id_key unique (clinic_id);
  end if;
end $$;

-- ── 2. whatsapp_conversations: bot_disabled column ───────────────────────────
-- Defined in migration 005 but missing in production.
alter table public.whatsapp_conversations
  add column if not exists bot_disabled boolean not null default false;

-- ── 3. whatsapp_conversations: current_step column ───────────────────────────
-- Defined in migration 031 but missing in production.
-- Persists current step so stepFromHistory() is immune to history truncation.
alter table public.whatsapp_conversations
  add column if not exists current_step integer not null default 1;

-- ── 4. whatsapp_conversations: phone UNIQUE constraint ───────────────────────
-- Defined in migration 030 but may be missing on some installs.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.whatsapp_conversations'::regclass
      and contype = 'u'
      and conname = 'whatsapp_conversations_phone_key'
  ) then
    drop index if exists public.whatsapp_conversations_phone_idx;
    alter table public.whatsapp_conversations
      add constraint whatsapp_conversations_phone_key unique (phone);
  end if;
end $$;
