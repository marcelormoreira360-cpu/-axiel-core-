-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 025 — Supabase Storage buckets
--
-- Creates the storage buckets used by the application.
--
-- patient-docs: privado; uploads/downloads passam pelo admin client
-- (service-role), então não há policy por usuário para ele.
--
-- clinic-assets: PÚBLICO para leitura e escrito direto pelo client
-- autenticado, então PRECISA de policies de INSERT/UPDATE/DELETE por pasta
-- clinic_id/* — ver migration 123_security_hardening.sql (originalmente
-- 044_clinic_assets_storage.sql, hoje em migrations_archive).
-- ─────────────────────────────────────────────────────────────────────────────

-- Patient documents uploaded via the /envio public intake page
-- and from within the clinic's patient profile.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-docs',
  'patient-docs',
  false,
  15728640, -- 15 MB in bytes
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit  = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Clinic branding assets (logos, etc.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinic-assets',
  'clinic-assets',
  true,          -- public so logo URLs work without signed URLs
  5242880,       -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
)
on conflict (id) do nothing;
