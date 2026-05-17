-- WhatsApp conversation history (leads & patients)
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL UNIQUE,
  clinic_id   text,
  messages    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- WhatsApp interaction log
CREATE TABLE IF NOT EXISTS whatsapp_interactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   text,
  patient_id  uuid REFERENCES patients(id) ON DELETE SET NULL,
  phone       text,
  direction   text CHECK (direction IN ('inbound', 'outbound')),
  message     text,
  reply       text,
  media_type  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: only service role accesses these tables (webhook uses service key)
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_interactions  ENABLE ROW LEVEL SECURITY;
