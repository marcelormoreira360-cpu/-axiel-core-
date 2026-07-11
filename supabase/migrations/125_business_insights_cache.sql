-- 125_business_insights_cache.sql
-- Cache para os insights de negócio gerados por IA (página Results), espelhando
-- o padrão de finance_insights (005_missing_tables.sql). Antes, os insights eram
-- REGERADOS por LLM a cada abertura da página e a cada troca de período
-- (1/3/6/12 meses), sem cache. Aqui a chave inclui `months` e `locale` porque o
-- insight varia por período e por idioma da clínica.
-- Segue o mesmo padrão: create if not exists, RLS, policies idempotentes.

create table if not exists public.business_insights (
  id            uuid        primary key default gen_random_uuid(),
  clinic_id     uuid        not null references public.clinics(id) on delete cascade,
  months        integer     not null,
  locale        text        not null default 'pt-BR',
  content       jsonb       not null,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists business_insights_lookup_idx
  on public.business_insights(clinic_id, months, locale, generated_at desc);

alter table public.business_insights enable row level security;

drop policy if exists "business_insights_select" on public.business_insights;
create policy "business_insights_select" on public.business_insights
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "business_insights_insert" on public.business_insights;
create policy "business_insights_insert" on public.business_insights
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "business_insights_delete" on public.business_insights;
create policy "business_insights_delete" on public.business_insights
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));
