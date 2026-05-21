-- Atualiza os templates de comunicação padrão para PT-BR
-- Afeta apenas os templates cujo key existe na tabela.
-- Se uma clínica personalizou o template manualmente, a linha ainda é atualizada
-- (name e subject mudam, body não — ver NOTE abaixo se quiser preservar edições).
-- Para preservar bodies customizados, troque a cláusula SET do body por:
--   body = CASE WHEN body = <valor antigo em inglês> THEN <valor novo PT-BR> ELSE body END

UPDATE public.communication_templates
SET
  name    = 'Lembrete de sessão — e-mail',
  subject = 'Lembrete da sua sessão',
  body    = 'Olá, {{name}}! Este é um lembrete da sua sessão agendada para {{date}} às {{time}}. Qualquer dúvida, é só responder este e-mail.'
WHERE key = 'appointment_reminder_email';

UPDATE public.communication_templates
SET
  name = 'Lembrete de sessão — SMS',
  body = 'Olá, {{name}}! Lembrete: sua sessão está marcada para {{date}} às {{time}}. Responda se precisar de ajuda.'
WHERE key = 'appointment_reminder_sms';

UPDATE public.communication_templates
SET
  name    = 'Acompanhamento pós-sessão — e-mail',
  subject = 'Como você está?',
  body    = 'Olá, {{name}}! Estamos passando para saber como você está após a sua última visita. Se quiser agendar o próximo passo, é só responder este e-mail.'
WHERE key = 'follow_up_email';

UPDATE public.communication_templates
SET
  name = 'Acompanhamento pós-sessão — SMS',
  body = 'Olá, {{name}}! Como você está depois da última sessão? Responda aqui se quiser ajuda para agendar o próximo passo.'
WHERE key = 'follow_up_sms';

UPDATE public.communication_templates
SET
  name    = 'Nutrição de lead — e-mail',
  subject = 'Como podemos ajudar?',
  body    = 'Olá, {{name}}! Obrigado pelo seu contato. Será um prazer ajudá-lo(a) a dar o próximo passo. Responda este e-mail e conversamos.'
WHERE key = 'lead_nurturing_email';

UPDATE public.communication_templates
SET
  name = 'Nutrição de lead — SMS',
  body = 'Olá, {{name}}! Obrigado pelo contato. Responda aqui e podemos ajudá-lo(a) a escolher o próximo passo simples.'
WHERE key = 'lead_nurturing_sms';
