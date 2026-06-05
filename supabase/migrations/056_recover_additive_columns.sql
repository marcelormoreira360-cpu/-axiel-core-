-- migration 056_recover_additive_columns.sql
-- Reconciliação: recupera colunas ADITIVAS de migrations que constam aplicadas
-- mas não tiveram efeito no banco (003, 004, 007 + assessment 002). Idempotente,
-- baixo risco (todas additivas, com defaults seguros).

-- 003 — clinic_users.zoom_personal_url (links de teleconsulta)
alter table public.clinic_users
  add column if not exists zoom_personal_url text;

-- 004 — patients: campos de nome/endereço
alter table public.patients
  add column if not exists first_name   text,
  add column if not exists last_name    text,
  add column if not exists address_line text,
  add column if not exists city         text,
  add column if not exists state        text,
  add column if not exists zip_code     text,
  add column if not exists country      text default 'Brasil';

-- 007 — plans: multi-moeda + flags + slug
alter table public.plans
  add column if not exists price_usd_cents integer,
  add column if not exists price_eur_cents integer,
  add column if not exists recommended     boolean not null default false,
  add column if not exists limits          jsonb   not null default '{}',
  add column if not exists slug            text;

-- backfill slug a partir de code (plans.code já existe e é único)
update public.plans set slug = code where slug is null and code is not null;
create unique index if not exists plans_slug_key on public.plans(slug);

-- 002 — assessment_responses.appointment_id (vínculo do formulário à sessão)
alter table public.assessment_responses
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

notify pgrst, 'reload schema';
