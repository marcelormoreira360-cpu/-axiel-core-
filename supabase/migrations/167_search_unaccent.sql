-- Busca global insensível a ACENTO (além de caixa) para pacientes e leads.
-- Aplicada na produção (bfuulpvzedcrpmmjxles) em 2 passos (167a/167b) via MCP;
-- este arquivo é o estado final idempotente para setup limpo / registro no repo.
--
-- Como funciona: coluna gerada `search_text` = unaccent(lower(nome+email+telefone)),
-- indexada com trigram (GIN) para ILIKE rápido. A rota /api/search normaliza cada
-- token do jeito igual e casa com ILIKE (AND entre tokens). Assim "jose" acha
-- "José", e "vitor pedro" / "pedro saldanha" acham "Pedro Vitor Saldanha de Moraes".

-- 1) Extensão unaccent (pg_trgm já existe no projeto) + wrapper IMMUTABLE.
create extension if not exists unaccent with schema extensions;

-- unaccent() não é immutable por padrão; a forma com dicionário explícito pode ser
-- encapsulada como immutable com segurança, para uso em coluna gerada e índice.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $func$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$func$;

-- 2) Coluna normalizada + índice trigram (pacientes e leads).
alter table public.patients
  add column if not exists search_text text
  generated always as (
    public.immutable_unaccent(lower(coalesce(full_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'')))
  ) stored;

alter table public.leads
  add column if not exists search_text text
  generated always as (
    public.immutable_unaccent(lower(coalesce(full_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'')))
  ) stored;

create index if not exists idx_patients_search_text_trgm
  on public.patients using gin (search_text extensions.gin_trgm_ops);

create index if not exists idx_leads_search_text_trgm
  on public.leads using gin (search_text extensions.gin_trgm_ops);
