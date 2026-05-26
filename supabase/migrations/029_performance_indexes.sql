-- ============================================================
-- Migration 029 — Performance indexes
-- Run this in Supabase Studio → SQL Editor
-- All indexes are CONCURRENTLY so they don't lock production writes.
-- ============================================================

-- ── patients ────────────────────────────────────────────────
-- Used by getPatients(), getPatientCount(), ilike search, patient_id FK joins

-- Fast exact lookups by clinic (every list/count query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_clinic_id
  ON patients (clinic_id);

-- Fast exact lookups by clinic + ordering (list page)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_clinic_created
  ON patients (clinic_id, created_at DESC);

-- Full-text / fuzzy search on name (ilike '%term%')
-- Requires pg_trgm extension (enabled by default on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_full_name_trgm
  ON patients USING GIN (full_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_email_trgm
  ON patients USING GIN (email gin_trgm_ops);

-- ── appointments ────────────────────────────────────────────
-- Used by getAppointments(), getAppointmentsByPatient(), dashboard queries

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_clinic_starts
  ON appointments (clinic_id, starts_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_patient_starts
  ON appointments (patient_id, starts_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_starts_at
  ON appointments (starts_at DESC);

-- ── session_records ─────────────────────────────────────────
-- Used by getSessionRecordsByPatient(), health-agent context builder

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_records_patient_created
  ON session_records (patient_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_records_clinic_created
  ON session_records (clinic_id, created_at DESC);

-- ── assessment_responses ────────────────────────────────────
-- Used by getPatientAssessmentResponses(), health-agent

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_responses_patient_filled
  ON assessment_responses (patient_id, filled_at DESC);

-- ── assessment_invitations ──────────────────────────────────
-- Used by /api/forms/submit token lookup (hot path for every form submission)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_invitations_token_hash
  ON assessment_invitations (token_hash);

-- ── patient_exams ────────────────────────────────────────────
-- Used by getPatientExams(), health-agent context builder

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patient_exams_patient_date
  ON patient_exams (patient_id, exam_date DESC);

-- ── follow_ups ───────────────────────────────────────────────
-- Used by processAutomations() bulk status queries

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_clinic_status
  ON follow_ups (clinic_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_scheduled_for
  ON follow_ups (scheduled_for)
  WHERE status = 'pending';

-- ── api_rate_limits ──────────────────────────────────────────
-- Used by checkRateLimitDb() on every API call

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_rate_limits_key_window
  ON api_rate_limits (key, window_start);

-- ── users ────────────────────────────────────────────────────
-- Used by getCurrentUserProfile() and getCurrentClinic() auth flow

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_clinic_id
  ON users (clinic_id);
