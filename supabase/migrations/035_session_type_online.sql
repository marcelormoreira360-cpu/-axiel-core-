-- ── 035: Add is_online flag to session_types ─────────────────────────────────
-- Controls whether a Zoom meeting is auto-created when this session type is booked.

ALTER TABLE public.session_types
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.session_types.is_online IS
  'When true, booking this session type auto-creates a Zoom meeting (if Zoom is connected).';
