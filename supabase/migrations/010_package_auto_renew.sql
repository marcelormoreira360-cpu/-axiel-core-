-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 010 — patient_packages: add auto_renew column
--
-- The package service (checkAndAutoRenewPackages) and the PatientPackagePanel
-- component already reference this column; the DB column was missing because
-- the original migration (036_package_recurrence.sql) was never activated.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.patient_packages
  add column if not exists auto_renew boolean not null default false;

comment on column public.patient_packages.auto_renew is
  'When true, a new package with the same settings is created automatically
   when the current package reaches sessions_total (handled in
   checkAndAutoRenewPackages in package-service.ts after each appointment).';
