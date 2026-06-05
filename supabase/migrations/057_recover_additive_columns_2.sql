-- migration 057_recover_additive_columns_2.sql
-- Reconciliação (2ª rodada): colunas additivas restantes faltando em produção.
-- Idempotente, baixo risco.

alter table public.assessment_responses
  add column if not exists updated_at timestamptz not null default now();
alter table public.assessment_templates
  add column if not exists updated_at timestamptz not null default now();
alter table public.hotmart_purchases
  add column if not exists updated_at timestamptz not null default now();
alter table public.repasse_rules
  add column if not exists updated_at timestamptz not null default now();

-- session_records.session_type_id (vínculo da nota ao tipo de sessão)
alter table public.session_records
  add column if not exists session_type_id uuid references public.session_types(id) on delete set null;

notify pgrst, 'reload schema';
