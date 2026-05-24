-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020 — Add price_cents + is_online to session_types
--
-- The initial schema omitted these columns from the remote database.
-- This migration brings it in sync idempotently.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.session_types
  add column if not exists price_cents integer not null default 0 check (price_cents >= 0),
  add column if not exists is_online   boolean not null default false;
