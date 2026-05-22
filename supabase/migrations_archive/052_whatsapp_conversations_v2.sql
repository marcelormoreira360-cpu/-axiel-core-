-- Add human takeover, bot disable, and entity linking to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS linked_patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_lead_id    uuid REFERENCES leads(id)    ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bot_disabled      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handled_by_human  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handled_by_name   text;

-- Index for faster lookup by clinic
CREATE INDEX IF NOT EXISTS whatsapp_conversations_clinic_id_idx
  ON public.whatsapp_conversations (clinic_id);

-- RLS policy: clinic staff can read their own conversations
DROP POLICY IF EXISTS "clinic_staff_read_conversations" ON public.whatsapp_conversations;
CREATE POLICY "clinic_staff_read_conversations"
  ON public.whatsapp_conversations
  FOR SELECT
  USING (
    clinic_id IN (
      SELECT clinic_id FROM public.users
      WHERE id = auth.uid() AND clinic_id IS NOT NULL
    )
  );
