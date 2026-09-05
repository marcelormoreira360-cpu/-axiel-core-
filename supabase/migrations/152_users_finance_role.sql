-- Migration 152: Papel financeiro por usuário — ERP Fase 6.2 (permissões por cargo)
--
-- Separa "quem vê o financeiro" de "quem altera". O papel financeiro é opcional
-- e ORTOGONAL ao papel geral (users.role): gestores/donos seguem com acesso
-- completo; o finance_role dá acesso graduado a quem não é gestor e permite
-- marcar um gestor como somente-leitura (CPA) ou sem aprovação.
--
--   cfo        → tudo + aprovar
--   controller → opera/edita/exporta (sem aprovar)
--   billing    → cria/edita recebível e conta (sem aprovar)
--   pricing    → dashboards/simulação + export (não edita lançamento)
--   cpa        → só leitura + export
--
-- Enforcement é no servidor (requireFinanceAccess/requireFinanceEdit + lib/
-- finance-permissions). Coluna aditiva, nullable — sem impacto em quem já existe.

alter table public.users
  add column if not exists finance_role text
  check (finance_role in ('cfo','controller','billing','pricing','cpa'));

comment on column public.users.finance_role is
  'Papel financeiro opcional (ERP Fase 6.2): cfo|controller|billing|pricing|cpa. Ortogonal a role. Null = sem papel financeiro específico (acesso segue o role geral).';
