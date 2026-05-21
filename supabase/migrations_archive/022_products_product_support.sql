-- AXIEL Core — Products & Product Support
-- Product support is connected to the patient journey. AI suggestions require human approval.

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  name text not null,
  category_id uuid references public.product_categories(id) on delete set null,
  description text,
  price_cents integer not null default 0,
  cost_cents integer,
  currency text not null default 'USD',
  sku text,
  inventory_quantity integer not null default 0,
  is_active boolean not null default true,
  approved_language text,
  restricted_claims text,
  safety_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.patient_products (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  linked_session_id uuid references public.appointments(id) on delete set null,
  linked_insight_id uuid references public.ai_insights(id) on delete set null,
  reason text,
  next_step text,
  status text not null default 'active',
  start_date date default current_date,
  review_date date,
  notes text,
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint patient_products_status_check check (status in ('active', 'paused', 'completed', 'canceled'))
);

create table if not exists public.product_suggestions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  linked_session_id uuid references public.appointments(id) on delete set null,
  linked_insight_id uuid references public.ai_insights(id) on delete set null,
  suggested_category text not null,
  reason text,
  safety_questions jsonb not null default '[]'::jsonb,
  follow_up_timing text,
  next_step text,
  source text not null default 'manual',
  status text not null default 'in_review',
  approved_by uuid references public.users(id) on delete set null,
  approved_at timestamptz,
  ignored_by uuid references public.users(id) on delete set null,
  ignored_at timestamptz,
  created_at timestamptz not null default now(),
  constraint product_suggestions_status_check check (status in ('in_review', 'approved', 'ignored')),
  constraint product_suggestions_source_check check (source in ('ai_placeholder', 'ai_generated', 'manual'))
);

create table if not exists public.product_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'USD',
  stripe_payment_intent_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_orders_status_check check (status in ('draft', 'pending', 'paid', 'delivered', 'canceled')),
  constraint product_orders_payment_status_check check (payment_status in ('unpaid', 'paid', 'refunded', 'failed'))
);

create table if not exists public.product_order_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  order_id uuid not null references public.product_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1,
  unit_price_cents integer not null default 0,
  total_price_cents integer not null default 0,
  created_at timestamptz not null default now(),
  constraint product_order_items_quantity_check check (quantity > 0)
);

create table if not exists public.product_refill_reminders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  patient_product_id uuid references public.patient_products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'pending',
  message text,
  created_by uuid references public.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint product_refill_reminders_status_check check (status in ('pending', 'completed', 'canceled'))
);

create index if not exists product_categories_clinic_id_idx on public.product_categories(clinic_id);
create index if not exists products_clinic_id_idx on public.products(clinic_id);
create index if not exists patient_products_clinic_patient_idx on public.patient_products(clinic_id, patient_id);
create index if not exists product_suggestions_clinic_patient_idx on public.product_suggestions(clinic_id, patient_id);
create index if not exists product_orders_clinic_id_idx on public.product_orders(clinic_id);
create index if not exists product_order_items_order_id_idx on public.product_order_items(order_id);
create index if not exists product_refill_reminders_clinic_patient_idx on public.product_refill_reminders(clinic_id, patient_id);

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.patient_products enable row level security;
alter table public.product_suggestions enable row level security;
alter table public.product_orders enable row level security;
alter table public.product_order_items enable row level security;
alter table public.product_refill_reminders enable row level security;

drop policy if exists "clinic users can read product categories" on public.product_categories;
create policy "clinic users can read product categories"
on public.product_categories for select
using (public.can_access_clinic(clinic_id));

drop policy if exists "clinic users can manage product categories" on public.product_categories;
create policy "clinic users can manage product categories"
on public.product_categories for all
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "clinic users can read products" on public.products;
create policy "clinic users can read products"
on public.products for select
using (public.can_access_clinic(clinic_id) and deleted_at is null);

drop policy if exists "clinic users can manage products" on public.products;
create policy "clinic users can manage products"
on public.products for all
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "clinic users can read patient products" on public.patient_products;
create policy "clinic users can read patient products"
on public.patient_products for select
using (public.can_access_clinic(clinic_id) and deleted_at is null);

drop policy if exists "clinic users can manage patient products" on public.patient_products;
create policy "clinic users can manage patient products"
on public.patient_products for all
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "clinic users can read product suggestions" on public.product_suggestions;
create policy "clinic users can read product suggestions"
on public.product_suggestions for select
using (public.can_access_clinic(clinic_id));

drop policy if exists "clinic users can manage product suggestions" on public.product_suggestions;
create policy "clinic users can manage product suggestions"
on public.product_suggestions for all
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "clinic users can read product orders" on public.product_orders;
create policy "clinic users can read product orders"
on public.product_orders for select
using (public.can_access_clinic(clinic_id));

drop policy if exists "clinic users can manage product orders" on public.product_orders;
create policy "clinic users can manage product orders"
on public.product_orders for all
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "clinic users can read product order items" on public.product_order_items;
create policy "clinic users can read product order items"
on public.product_order_items for select
using (public.can_access_clinic(clinic_id));

drop policy if exists "clinic users can manage product order items" on public.product_order_items;
create policy "clinic users can manage product order items"
on public.product_order_items for all
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "clinic users can read product refill reminders" on public.product_refill_reminders;
create policy "clinic users can read product refill reminders"
on public.product_refill_reminders for select
using (public.can_access_clinic(clinic_id));

drop policy if exists "clinic users can manage product refill reminders" on public.product_refill_reminders;
create policy "clinic users can manage product refill reminders"
on public.product_refill_reminders for all
using (public.can_write_clinic_data(clinic_id))
with check (public.can_write_clinic_data(clinic_id));

create or replace function public.validate_product_support_clinic()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name in ('patient_products', 'product_suggestions', 'product_refill_reminders') then
    if new.patient_id is not null and not exists (
      select 1 from public.patients p where p.id = new.patient_id and p.clinic_id = new.clinic_id
    ) then
      raise exception 'Patient does not belong to the same clinic.';
    end if;
  end if;

  if tg_table_name in ('patient_products', 'product_order_items', 'product_refill_reminders') then
    if new.product_id is not null and not exists (
      select 1 from public.products pr where pr.id = new.product_id and pr.clinic_id = new.clinic_id
    ) then
      raise exception 'Product does not belong to the same clinic.';
    end if;
  end if;

  if tg_table_name = 'product_order_items' then
    if not exists (
      select 1 from public.product_orders po where po.id = new.order_id and po.clinic_id = new.clinic_id
    ) then
      raise exception 'Order does not belong to the same clinic.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_patient_products_clinic on public.patient_products;
create or replace trigger validate_patient_products_clinic
before insert or update on public.patient_products
for each row execute function public.validate_product_support_clinic();

drop trigger if exists validate_product_order_items_clinic on public.product_order_items;
create or replace trigger validate_product_order_items_clinic
before insert or update on public.product_order_items
for each row execute function public.validate_product_support_clinic();

drop trigger if exists validate_product_refill_reminders_clinic on public.product_refill_reminders;
create or replace trigger validate_product_refill_reminders_clinic
before insert or update on public.product_refill_reminders
for each row execute function public.validate_product_support_clinic();

insert into public.product_categories (clinic_id, name, description)
select c.id, v.name, v.description
from public.clinics c
cross join (
  values
    ('Supplements', 'Support items used by the clinic.'),
    ('Exams / Tests', 'Tests or assessments offered by the clinic.'),
    ('Devices', 'Devices connected to patient support.'),
    ('Kits', 'Bundles of support items.'),
    ('Digital Products', 'Digital support resources.'),
    ('Session Add-ons', 'Items connected to a Session.'),
    ('Other', 'Other product support items.')
) as v(name, description)
where not exists (
  select 1 from public.product_categories pc
  where pc.clinic_id = c.id and pc.name = v.name
);
