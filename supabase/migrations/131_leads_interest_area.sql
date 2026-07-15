-- =============================================================================
-- 131_leads_interest_area.sql
-- Blindagem de PHI (parecer do Lex, 2026-07-14) — lado Core.
-- Espelha a migration 0023 do AXIEL Growth: o Growth trocou o campo LIVRE
-- `pain` (queixa clínica em texto livre) por `interest_area` FECHADO e não
-- clínico, e agora envia `interest_area` no hand-off. Esta migration cria a
-- coluna no Core para o lead do Growth ser persistido de forma estruturada.
--
-- Não insere dados. Seguro para aplicar antes do deploy do código.
-- Aplicar em produção junto do lote de deploy hardening (item 6 do roadmap
-- Fase 1), casado com a 0023 do Growth. RLS herdada da tabela `leads`.
-- =============================================================================

alter table public.leads
  add column if not exists interest_area text
    check (
      interest_area is null
      or interest_area in ('energy', 'sleep', 'stress', 'performance', 'general')
    );

comment on column public.leads.interest_area is
  'Área de interesse fechada e não clínica vinda do AXIEL Growth (energy|sleep|stress|performance|general). Substitui o antigo campo livre de queixa.';
