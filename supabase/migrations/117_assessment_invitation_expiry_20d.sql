-- Aumenta a validade padrão dos convites de questionário de 7 para 20 dias.
-- Pacientes costumavam encontrar o link já expirado quando demoravam alguns dias
-- para responder. O código também passa a gravar expires_at explícito (20 dias),
-- este default cobre qualquer caminho que omita a coluna.
alter table public.assessment_invitations
  alter column expires_at set default (now() + interval '20 days');
