-- Add patient-reported vitals (1–5 scale) to session records.
-- Stored as JSONB so new metrics can be added without schema changes.
-- Example: {"dor": 3, "energia": 4, "humor": 5, "sono": 2}

alter table session_records
  add column if not exists vitals jsonb default null;
