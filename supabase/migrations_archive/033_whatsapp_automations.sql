-- ── 033: WhatsApp automation channel support ─────────────────────────────────
-- Adds 'whatsapp' to follow_up_channel enum and communication_logs channel check.

ALTER TYPE public.follow_up_channel ADD VALUE IF NOT EXISTS 'whatsapp';

ALTER TABLE public.communication_logs
  DROP CONSTRAINT IF EXISTS communication_logs_channel_check;

ALTER TABLE public.communication_logs
  ADD CONSTRAINT communication_logs_channel_check
  CHECK (channel IN ('email', 'sms', 'whatsapp'));
