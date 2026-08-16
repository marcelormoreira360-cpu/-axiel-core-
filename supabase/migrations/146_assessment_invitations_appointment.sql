-- 146_assessment_invitations_appointment.sql
-- Vincula o convite de questionário ao agendamento que o gerou.
--
-- Motivo: o link do questionário (/f/[token]) valia pela validade fixa (20-30 dias),
-- então o paciente conseguia responder MESMO depois de a data da sessão já ter
-- passado. Guardando o agendamento de origem, o link passa a ser bloqueado assim
-- que essa sessão passa (ver getInvitationByToken). Se a sessão for remarcada, o
-- link acompanha a nova data automaticamente (o mesmo appointment muda de starts_at).
--
-- Nullable: convites avulsos/manuais e o QR público NÃO têm agendamento e seguem
-- pela validade normal. on delete set null: apagar o agendamento não apaga o convite.

ALTER TABLE assessment_invitations
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assessment_invitations_appointment_id_idx
  ON assessment_invitations(appointment_id);

COMMENT ON COLUMN assessment_invitations.appointment_id IS
  'Agendamento que originou o convite (onboarding da 1a sessao). O link do /f expira quando essa sessao passa. NULL = convite avulso/manual/QR publico (segue pela validade normal).';
