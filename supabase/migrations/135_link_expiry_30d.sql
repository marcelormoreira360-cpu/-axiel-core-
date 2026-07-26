-- Padroniza a validade dos links enviados ao paciente para 30 dias.
-- Antes: convite de formulário (assessment_invitations) tinha default de 20 dias
-- (migration 117). O código já passa expires_at explícito na maioria dos fluxos
-- (onboarding, confirmação de agendamento, portal), mas o convite individual
-- de formulário (createAssessmentInvitation) depende do DEFAULT do banco.
-- Esta migration alinha o default a 30 dias. Não altera links já emitidos.
alter table public.assessment_invitations
  alter column expires_at set default (now() + interval '30 days');
