-- Migration 037: DEBT-07 — add undocumented columns used by services
-- These columns exist in production (created manually) but were never in a migration.
-- Adding with IF NOT EXISTS so safe to run on fresh installs.

-- ── clinics.whatsapp_number ──────────────────────────────────────────────────
-- Used in automation-service.ts to build wa.me/ links in reminder emails.
alter table public.clinics
  add column if not exists whatsapp_number text;

-- ── calendar_integrations: sync_token + last_synced_at ──────────────────────
-- Used by google-calendar-service.ts for incremental sync.
alter table public.calendar_integrations
  add column if not exists sync_token text;

alter table public.calendar_integrations
  add column if not exists last_synced_at timestamptz;

-- ── whatsapp_bot_configs: max length enforcement at DB level (SEC-02) ────────
-- Protects against excessively large payloads in free-text fields.
-- Note: check constraints on length are advisory — the real enforcement
-- is in the server action, but belt-and-suspenders is good practice.
alter table public.whatsapp_bot_configs
  add constraint whatsapp_bot_configs_methodology_length
  check (length(methodology) <= 5000)
  not valid;  -- NOT VALID: skip retroactive check on existing rows

alter table public.whatsapp_bot_configs
  add constraint whatsapp_bot_configs_custom_instructions_length
  check (length(custom_instructions) <= 3000)
  not valid;
