-- Migration 078: link de confirmação de agendamento
--
-- Fluxo: o terapeuta clica num horário da agenda e gera um link de confirmação.
-- O agendamento é criado como 'pending' (segura o horário) e só vira 'confirmed'
-- quando o paciente abre o link, completa os dados e confirma o horário.

-- 1. Novo status 'pending' (aguardando confirmação do paciente)
DO $$
BEGIN
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('pending','scheduled','confirmed','completed','cancelled','no_show'));
END $$;

-- 2. Token de confirmação + expiração + carimbo de confirmação
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS confirm_token_hash text,
  ADD COLUMN IF NOT EXISTS confirm_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at        timestamptz;

-- Índice único parcial: cada token mapeia para no máximo 1 agendamento
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_confirm_token
  ON public.appointments (confirm_token_hash)
  WHERE confirm_token_hash IS NOT NULL;

COMMENT ON COLUMN public.appointments.confirm_token_hash IS
  'SHA-256 do token do link de confirmação (status pending). Limpo ao confirmar.';

NOTIFY pgrst, 'reload schema';
