-- 130_cron_runs_single_running.sql
-- Trava de concorrência ATÔMICA para os crons (CronGuard). Antes, a guarda era
-- check-then-insert (TOCTOU): duas invocações quase simultâneas podiam ambas
-- passar e rodar em duplicidade. Um índice único PARCIAL garante que só exista
-- UM registro 'running' por job — o 2º insert concorrente falha (23505) e o
-- CronGuard trata como "já em execução, pular".
--
-- Runs 'running' órfãos (jobs que crasharam sem finish/fail) são liberados pelo
-- próprio CronGuard (reclaim por janela in-flight) antes do insert. Aqui, no
-- deploy, zeramos qualquer 'running' pendente (o deploy reinicia as funções, então
-- nada está de fato rodando) para o índice poder ser criado sem duplicatas.

update public.cron_runs
  set status = 'error', error_message = coalesce(error_message, 'reclaimed on deploy')
  where status = 'running';

create unique index if not exists cron_runs_single_running_idx
  on public.cron_runs(job_name)
  where status = 'running';
