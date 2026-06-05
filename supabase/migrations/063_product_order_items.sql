-- migration 063_product_order_items.sql
-- Feature de Produtos, Fase 1 (modelo de dados): itens do pedido + Asaas no pedido.

-- Itens do pedido (cada linha = um produto x quantidade)
create table if not exists public.product_order_items (
  id               uuid        primary key default gen_random_uuid(),
  order_id         uuid        not null references public.product_orders(id) on delete cascade,
  clinic_id        uuid        not null references public.clinics(id) on delete cascade,
  product_id       uuid        references public.products(id) on delete set null,
  name             text        not null,
  unit_price_cents integer     not null check (unit_price_cents >= 0),
  quantity         integer     not null default 1 check (quantity > 0),
  line_total_cents integer     not null check (line_total_cents >= 0),
  created_at       timestamptz not null default now()
);

create index if not exists product_order_items_order_id_idx  on public.product_order_items(order_id);
create index if not exists product_order_items_clinic_id_idx on public.product_order_items(clinic_id);

alter table public.product_order_items enable row level security;
drop policy if exists "product_order_items_select" on public.product_order_items;
create policy "product_order_items_select" on public.product_order_items
  for select to authenticated using (public.can_access_clinic(clinic_id::uuid));
drop policy if exists "product_order_items_write" on public.product_order_items;
create policy "product_order_items_write" on public.product_order_items
  for all to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid))
  with check (public.can_write_clinic_data(clinic_id::uuid));

-- Cobrança via Asaas no pedido (espelha stripe_payment_intent_id)
alter table public.product_orders
  add column if not exists asaas_payment_id text;
create unique index if not exists product_orders_asaas_id_uidx
  on public.product_orders(asaas_payment_id)
  where asaas_payment_id is not null;

notify pgrst, 'reload schema';
