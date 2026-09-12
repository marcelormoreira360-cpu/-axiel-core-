-- 170: clara_city_pricing — fonte ÚNICA do que a Clara COTA por cidade.
-- O banco vira a verdade dos preços/serviços de vitrine (Orlando/SP/Maringá),
-- em vez da tabela cravada em lib/whatsapp-bot-defaults.ts. Serviços agendáveis
-- (Orlando) ligam de volta a session_types via session_type_id. SP/Maringá são
-- cotação (can_book_directly=false; a equipe confirma). Multi-tenant + RLS.
create table if not exists public.clara_city_pricing (
  id                 uuid        primary key default gen_random_uuid(),
  clinic_id          uuid        not null references public.clinics(id) on delete cascade,
  city               text        not null,
  service_key        text        not null,
  public_name        text        not null,
  price_cents        integer     not null,
  currency           text        not null default 'USD',
  price_prefix       text,                      -- 'from' = "a partir de"
  includes           text,
  can_offer          boolean     not null default true,
  can_book_directly  boolean     not null default false,
  session_type_id    uuid        references public.session_types(id) on delete set null,
  sort_order         integer     not null default 0,
  effective_date     date,
  approved_by        text,
  is_active          boolean     not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (clinic_id, city, service_key)
);

create index if not exists clara_city_pricing_clinic_idx on public.clara_city_pricing(clinic_id);

drop trigger if exists set_clara_city_pricing_updated_at on public.clara_city_pricing;
create trigger set_clara_city_pricing_updated_at
before update on public.clara_city_pricing
for each row execute function public.set_updated_at();

alter table public.clara_city_pricing enable row level security;

drop policy if exists "clara_city_pricing_select" on public.clara_city_pricing;
create policy "clara_city_pricing_select" on public.clara_city_pricing
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "clara_city_pricing_insert" on public.clara_city_pricing;
create policy "clara_city_pricing_insert" on public.clara_city_pricing
  for insert to authenticated
  with check (public.can_manage_clinic(clinic_id::uuid));

drop policy if exists "clara_city_pricing_update" on public.clara_city_pricing;
create policy "clara_city_pricing_update" on public.clara_city_pricing
  for update to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));

drop policy if exists "clara_city_pricing_delete" on public.clara_city_pricing;
create policy "clara_city_pricing_delete" on public.clara_city_pricing
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));
