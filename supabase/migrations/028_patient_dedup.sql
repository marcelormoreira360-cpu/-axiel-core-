-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 028 — Patient deduplication safeguards
--
-- Adds a partial unique index so two patients with the same email cannot exist
-- in the same clinic. NULL emails are excluded (phone-only records are allowed).
-- ─────────────────────────────────────────────────────────────────────────────

create unique index if not exists patients_clinic_email_unique
  on public.patients (clinic_id, lower(email))
  where email is not null;
