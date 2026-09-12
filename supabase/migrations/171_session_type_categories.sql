-- 171: cor/ícone da agenda por CATEGORIA (não por tipo individual). Tabela de
-- categorias reutilizável; os ~19 session_types apontam para poucas categorias.
-- Override opcional por tipo fica para depois (session_types.color_override).
create table if not exists public.session_type_categories (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id) on delete cascade,
  name        text        not null,
  color       text        not null,              -- hex, ex.: #0F6E56
  icon        text,                              -- nome do ícone tabler, ex.: 'stethoscope'
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (clinic_id, name)
);

create index if not exists session_type_categories_clinic_idx on public.session_type_categories(clinic_id);

alter table public.session_types
  add column if not exists category_id uuid references public.session_type_categories(id) on delete set null;
alter table public.session_types
  add column if not exists color_override text;   -- hex opcional; sobrescreve a cor da categoria

create index if not exists session_types_category_idx on public.session_types(category_id);

drop trigger if exists set_session_type_categories_updated_at on public.session_type_categories;
create trigger set_session_type_categories_updated_at
before update on public.session_type_categories
for each row execute function public.set_updated_at();

alter table public.session_type_categories enable row level security;

drop policy if exists "session_type_categories_select" on public.session_type_categories;
create policy "session_type_categories_select" on public.session_type_categories
  for select to authenticated using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "session_type_categories_insert" on public.session_type_categories;
create policy "session_type_categories_insert" on public.session_type_categories
  for insert to authenticated with check (public.can_manage_clinic(clinic_id::uuid));

drop policy if exists "session_type_categories_update" on public.session_type_categories;
create policy "session_type_categories_update" on public.session_type_categories
  for update to authenticated using (public.can_manage_clinic(clinic_id::uuid));

drop policy if exists "session_type_categories_delete" on public.session_type_categories;
create policy "session_type_categories_delete" on public.session_type_categories
  for delete to authenticated using (public.can_manage_clinic(clinic_id::uuid));
