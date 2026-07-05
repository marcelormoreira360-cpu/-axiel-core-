-- 116: deduplicação de webhooks da Meta (Instagram / Facebook Messenger / WhatsApp).
-- A Meta REENVIA o webhook quando não recebe 200 rápido (a chamada ao LLM demora),
-- e cada reenvio do MESMO evento gerava uma nova resposta do bot (com fraseado
-- diferente, porque o LLM é regenerado a cada tentativa). Resultado: respostas
-- duplicadas e desconexas em sequência para o paciente.
--
-- Cada mensagem recebida com id único (mid do IG/FB, id do message object no
-- WhatsApp) é registrada aqui via INSERT ... ON CONFLICT DO NOTHING antes de ser
-- processada; se a linha JÁ existia, o evento é um retry da Meta e é ignorado.
--
-- Acesso: só os webhooks escrevem aqui, sempre via client admin (service_role).
-- RLS ligada sem policies bloqueia anon/authenticated (service_role ignora RLS).
create table if not exists public.meta_processed_messages (
  mid text primary key,
  created_at timestamptz not null default now()
);

alter table public.meta_processed_messages enable row level security;

-- Limpeza: a janela de retry da Meta é de horas, então linhas velhas (ex.: mais
-- de 7 dias) podem ser removidas por um cron futuramente, usando created_at.
-- O PK em mid já cobre a consulta do dedup; nenhum índice extra é necessário.
