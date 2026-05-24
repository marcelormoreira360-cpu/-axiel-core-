-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 025 — Supabase Storage buckets
--
-- Creates the private storage buckets used by the application.
-- The admin client (service-role key) is used for all uploads/downloads,
-- so no per-user RLS storage policies are needed — the buckets just need
-- to exist and be private.
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
