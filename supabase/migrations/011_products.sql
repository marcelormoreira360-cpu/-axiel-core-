-- products catalog table
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
create index if not exists products_is_active_idx  on public.products(clinic_id, is_active);

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

-- patient_products (prescriptions/assignments)
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
  for select to authenticated
  using (public.can_access_clinic(clinic_id));

drop policy if exists "patient_products_insert" on public.patient_products;
create policy "patient_products_insert" on public.patient_products
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "patient_products_update" on public.patient_products;
create policy "patient_products_update" on public.patient_products
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id));

drop policy if exists "patient_products_delete" on public.patient_products;
create policy "patient_products_delete" on public.patient_products
  for delete to authenticated
  using (public.can_write_clinic_data(clinic_id));
