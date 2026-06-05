-- migration 059_recover_orders_recordings.sql
-- Reconciliação: recria product_orders e zoom_recordings (DDL idêntica à 005),
-- ambas em uso no código (/products/orders e webhook/serviço do Zoom) mas
-- ausentes em produção. Idempotente.
-- (media = bucket de storage, não tabela; meta_conversations = legado morto — ignoradas)

-- ── product_orders ───────────────────────────────────────────────────────────
create table if not exists public.product_orders (
  id                       uuid        primary key default gen_random_uuid(),
  clinic_id                uuid        not null references public.clinics(id) on delete cascade,
  patient_id               uuid        references public.patients(id) on delete set null,
  created_by               uuid        references public.users(id) on delete set null,
  status                   text        not null default 'pending'
                                       check (status in ('draft', 'pending', 'paid', 'delivered', 'canceled')),
  payment_status           text        not null default 'unpaid'
                                       check (payment_status in ('unpaid', 'paid', 'refunded', 'failed')),
  subtotal_cents           integer     not null default 0,
  tax_cents                integer     not null default 0,
  total_cents              integer     not null default 0,
  currency                 text        not null default 'BRL',
  stripe_payment_intent_id text,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists product_orders_clinic_id_idx  on public.product_orders(clinic_id);
create index if not exists product_orders_patient_id_idx on public.product_orders(patient_id);
create index if not exists product_orders_status_idx     on public.product_orders(status);

alter table public.product_orders enable row level security;
drop policy if exists "product_orders_select" on public.product_orders;
create policy "product_orders_select" on public.product_orders
  for select to authenticated using (public.can_access_clinic(clinic_id::uuid));
drop policy if exists "product_orders_insert" on public.product_orders;
create policy "product_orders_insert" on public.product_orders
  for insert to authenticated with check (public.can_write_clinic_data(clinic_id::uuid));
drop policy if exists "product_orders_update" on public.product_orders;
create policy "product_orders_update" on public.product_orders
  for update to authenticated using (public.can_write_clinic_data(clinic_id::uuid));
drop policy if exists "product_orders_delete" on public.product_orders;
create policy "product_orders_delete" on public.product_orders
  for delete to authenticated using (public.can_manage_clinic(clinic_id::uuid));

-- ── zoom_recordings ──────────────────────────────────────────────────────────
create table if not exists public.zoom_recordings (
  id               uuid        primary key default gen_random_uuid(),
  clinic_id        uuid        not null references public.clinics(id) on delete cascade,
  appointment_id   uuid        references public.appointments(id) on delete set null,
  patient_id       uuid        references public.patients(id) on delete set null,
  zoom_meeting_id  text        not null,
  recording_id     text        not null unique,
  file_type        text,
  file_size        bigint,
  play_url         text,
  download_url     text,
  recording_start  timestamptz,
  recording_end    timestamptz,
  status           text        not null default 'completed',
  created_at       timestamptz not null default now()
);

create index if not exists zoom_recordings_clinic_id_idx      on public.zoom_recordings(clinic_id);
create index if not exists zoom_recordings_appointment_id_idx on public.zoom_recordings(appointment_id);
create index if not exists zoom_recordings_patient_id_idx     on public.zoom_recordings(patient_id);
create index if not exists zoom_recordings_meeting_id_idx     on public.zoom_recordings(zoom_meeting_id);

alter table public.zoom_recordings enable row level security;
drop policy if exists "zoom_recordings_select" on public.zoom_recordings;
create policy "zoom_recordings_select" on public.zoom_recordings
  for select to authenticated using (public.can_access_clinic(clinic_id::uuid));
drop policy if exists "zoom_recordings_insert" on public.zoom_recordings;
create policy "zoom_recordings_insert" on public.zoom_recordings
  for insert to service_role with check (true);
drop policy if exists "zoom_recordings_delete" on public.zoom_recordings;
create policy "zoom_recordings_delete" on public.zoom_recordings
  for delete to authenticated using (public.can_manage_clinic(clinic_id::uuid));

notify pgrst, 'reload schema';
