-- WhatsApp bot configuration per clinic
CREATE TABLE IF NOT EXISTS whatsapp_bot_configs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            text NOT NULL,
  twilio_number        text UNIQUE,           -- maps Twilio number to this clinic
  professional_name    text NOT NULL DEFAULT '',
  clinic_name          text NOT NULL DEFAULT '',
  specialty            text NOT NULL DEFAULT '', -- e.g. "microfisioterapia e abordagem integrativa"
  methodology          text NOT NULL DEFAULT '', -- description of the approach/program
  locations            jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- locations format: [{ city: "São Paulo", plans: [{ name: "Essencial", price: "$500", description: "..." }] }]
  language             text NOT NULL DEFAULT 'pt-BR', -- pt-BR | pt-PT | en-US
  custom_instructions  text NOT NULL DEFAULT '',
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_bot_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_own_whatsapp_config" ON whatsapp_bot_configs
  USING (clinic_id = (
    SELECT clinic_id FROM users WHERE id = auth.uid()
  ));
