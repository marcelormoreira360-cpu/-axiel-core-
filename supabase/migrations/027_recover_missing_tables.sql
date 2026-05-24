-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 027 — Recuperar tabelas que não foram criadas
--
-- As migrations 011, 013, 015, 016 foram registradas no histórico do Supabase
-- mas o SQL não foi executado. Esta migration recria as tabelas faltantes.
-- Usa CREATE TABLE IF NOT EXISTS para ser idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── products (de 011_products.sql) ───────────────────────────────────────────
create table if not exists public.products (
  id                 uuid        primary key default gen_random_uuid(),
  clinic_id          uuid        not null references public.clinics(id) on delete cascade,
  created_by         uuid        references public.users(id) on delete set null,
  name               text        not null,
  category           text        not null default 'Outro',
  description        text,
  price_cents        integer     not null default 0,
  cost_cents         integer,
  currency           text        not null default 'BRL',
  sku                text,
  inventory_quantity integer     not null default 0,
  is_active          boolean     not null default true,
  safety_notes       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists products_clinic_id_idx on public.products(clinic_id);
create index if not exists products_is_active_idx on public.products(clinic_id, is_active);

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products
  for select to authenticated
  using (public.can_access_clinic(clinic_id));

drop policy if exists "products_insert" on public.products;
create policy "products_insert" on public.products
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "products_update" on public.products;
create policy "products_update" on public.products
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id));

drop policy if exists "products_delete" on public.products;
create policy "products_delete" on public.products
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id));

-- ── patient_products (de 011_products.sql) ───────────────────────────────────
create table if not exists public.patient_products (
  id           uuid        primary key default gen_random_uuid(),
  clinic_id    uuid        not null references public.clinics(id) on delete cascade,
  patient_id   uuid        not null references public.patients(id) on delete cascade,
  product_id   uuid        references public.products(id) on delete set null,
  product_name text        not null,
  reason       text,
  notes        text,
  status       text        not null default 'active'
               check (status in ('active', 'paused', 'completed', 'canceled')),
  review_date  date,
  created_by   uuid        references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists patient_products_patient_id_idx on public.patient_products(patient_id);
create index if not exists patient_products_clinic_id_idx  on public.patient_products(clinic_id);

drop trigger if exists set_patient_products_updated_at on public.patient_products;
create trigger set_patient_products_updated_at
  before update on public.patient_products
  for each row execute function public.set_updated_at();

alter table public.patient_products enable row level security;

drop policy if exists "patient_products_select" on public.patient_products;
create policy "patient_products_select" on public.patient_products
  for select to authenticated using (public.can_access_clinic(clinic_id));

drop policy if exists "patient_products_insert" on public.patient_products;
create policy "patient_products_insert" on public.patient_products
  for insert to authenticated with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "patient_products_update" on public.patient_products;
create policy "patient_products_update" on public.patient_products
  for update to authenticated using (public.can_write_clinic_data(clinic_id));

drop policy if exists "patient_products_delete" on public.patient_products;
create policy "patient_products_delete" on public.patient_products
  for delete to authenticated using (public.can_write_clinic_data(clinic_id));

-- ── rate_limit_buckets (de 013_rate_limit_buckets.sql) ───────────────────────
create table if not exists public.rate_limit_buckets (
  key          text        not null,
  window_start timestamptz not null,
  count        int         not null default 1,
  primary key  (key, window_start)
);

create or replace function public.check_rate_limit(
  p_key          text,
  p_window_start timestamptz,
  p_max_requests int
) returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.rate_limit_buckets
  where key = p_key and window_start < p_window_start;

  insert into public.rate_limit_buckets (key, window_start, count)
    values (p_key, p_window_start, 1)
  on conflict (key, window_start) do update
    set count = rate_limit_buckets.count + 1
  returning count into v_count;

  return v_count <= p_max_requests;
end;
$$;

alter table public.rate_limit_buckets enable row level security;
drop policy if exists "service role only" on public.rate_limit_buckets;
create policy "service role only" on public.rate_limit_buckets using (false);

-- ── portal_messages (de 015_portal_messages.sql) ─────────────────────────────
create table if not exists public.portal_messages (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id)  on delete cascade,
  patient_id  uuid        not null references public.patients(id) on delete cascade,
  direction   text        not null check (direction in ('clinic_to_patient', 'patient_to_clinic')),
  body        text        not null check (char_length(body) between 1 and 2000),
  read_at     timestamptz,
  created_by  uuid        references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists portal_messages_conversation_idx
  on public.portal_messages (clinic_id, patient_id, created_at asc);

create index if not exists portal_messages_unread_idx
  on public.portal_messages (clinic_id, patient_id, direction, read_at)
  where read_at is null;

alter table public.portal_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'portal_messages'
      and policyname = 'Clinic members can manage portal_messages'
  ) then
    execute $policy$
      create policy "Clinic members can manage portal_messages"
        on public.portal_messages for all
        using (
          clinic_id in (
            select clinic_id from public.clinic_users
            where user_id = auth.uid() and status = 'active'
          )
        )
    $policy$;
  end if;
end $$;

-- ── push_subscriptions (de 016_push_subscriptions.sql) ───────────────────────
create table if not exists public.push_subscriptions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.users(id)   on delete cascade,
  clinic_id    uuid        not null references public.clinics(id) on delete cascade,
  endpoint     text        not null,
  p256dh       text        not null,
  auth         text        not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx   on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_clinic_idx on public.push_subscriptions (clinic_id);

alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'push_subscriptions'
      and policyname = 'Users manage own push subscriptions'
  ) then
    execute $policy$
      create policy "Users manage own push subscriptions"
        on public.push_subscriptions for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid())
    $policy$;
  end if;
end $$;
