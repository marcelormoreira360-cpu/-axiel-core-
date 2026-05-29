-- Migration 042: add single-use token support to patient_portal_links
--
-- Adds two columns:
--   is_single_use  — when true, the token is invalidated after the first successful view
--   used_at        — timestamp of first use (NULL = not yet used)
--
-- Existing links are NOT single-use (is_single_use defaults to false).
-- NPS email links (created by automation-service) set is_single_use = true.

ALTER TABLE public.patient_portal_links
  ADD COLUMN IF NOT EXISTS is_single_use boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS used_at       timestamptz;

COMMENT ON COLUMN public.patient_portal_links.is_single_use IS
  'When true the token is consumed on first successful view and cannot be reused';

COMMENT ON COLUMN public.patient_portal_links.used_at IS
  'Timestamp of first use; set automatically when is_single_use=true and the portal is opened';
