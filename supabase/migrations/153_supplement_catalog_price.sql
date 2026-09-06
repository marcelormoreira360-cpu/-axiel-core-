-- 153_supplement_catalog_price.sql
-- Preço no catálogo de suplementos. Usado na carga do catálogo DFH (preço "retail",
-- o que o paciente paga) e, no futuro, exibível no documento de suplementação.
-- Aditivo e idempotente; não altera dados existentes.

alter table public.supplement_catalog
  add column if not exists retail_price   numeric(10,2),
  add column if not exists price_currency text default 'USD',
  -- true quando o preço é "a partir de" (produto com múltiplos tamanhos/dosagens).
  add column if not exists price_is_from  boolean not null default false;

comment on column public.supplement_catalog.retail_price is
  'Preço de varejo (o que o paciente paga). Na carga DFH, o valor "retail" do site.';
comment on column public.supplement_catalog.price_is_from is
  'true = preço "a partir de" (produto com múltiplos tamanhos/dosagens).';

notify pgrst, 'reload schema';
