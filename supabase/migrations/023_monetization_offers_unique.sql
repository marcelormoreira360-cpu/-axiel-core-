-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 023 — Unique constraint: monetization_offers(clinic_id, name)
--
-- Prevents duplicate offer names per clinic.
-- Before applying, remove any existing duplicates via:
--   DELETE FROM monetization_offers WHERE id NOT IN (
--     SELECT MIN(id) FROM monetization_offers GROUP BY clinic_id, name
--   );
-- ─────────────────────────────────────────────────────────────────────────────

-- Unique index is idempotent (IF NOT EXISTS) and enforces the same constraint
create unique index if not exists monetization_offers_clinic_id_name_key
  on public.monetization_offers (clinic_id, name);
