-- 005_missing_tables.sql
-- Creates the 22 tables that exist in the application code but have no active migration.
-- Follows the same patterns as 001_initial_schema.sql:
--   create table if not exists, enable row level security, create policy (idempotent).

-- ── 1. assessment_invitations ──────────────────────────────────────────────────
-- Secure token-based invitations for patients to fill an assessment form.

create table if not exists public.assessment_invitations (
  id            uuid        primary key default gen_random_uuid(),
  clinic_id     uuid        not null references public.clinics(id) on delete cascade,
  patient_id    uuid        not null references public.patients(id) on delete cascade,
  template_id   uuid        not null references public.assessment_templates(id) on delete cascade,
  token_hash    text        not null unique,
  expires_at    timestamptz not null default (now() + interval '15 days'),
  completed_at  timestamptz,
  response_id   uuid        references public.assessment_responses(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists assessment_invitations_token_hash_idx on public.assessment_invitations(token_hash);
create index if not exists assessment_invitations_patient_id_idx  on public.assessment_invitations(patient_id);
create index if not exists assessment_invitations_clinic_id_idx   on public.assessment_invitations(clinic_id);

alter table public.assessment_invitations enable row level security;

drop policy if exists "assessment_invitations_select" on public.assessment_invitations;
create policy "assessment_invitations_select" on public.assessment_invitations
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "assessment_invitations_insert" on public.assessment_invitations;
create policy "assessment_invitations_insert" on public.assessment_invitations
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "assessment_invitations_update" on public.assessment_invitations;
create policy "assessment_invitations_update" on public.assessment_invitations
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "assessment_invitations_delete" on public.assessment_invitations;
create policy "assessment_invitations_delete" on public.assessment_invitations
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));


-- ── 2. calendar_integrations ───────────────────────────────────────────────────
-- Stores OAuth tokens for external calendar providers (Google Calendar, etc.) per clinic.

alter table if exists public.calendar_integrations
  add column if not exists clinic_id        uuid references public.clinics(id) on delete cascade,
  add column if not exists provider         text,
  add column if not exists access_token     text,
  add column if not exists refresh_token    text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists calendar_id      text,
  add column if not exists connected_at     timestamptz,
  add column if not exists connected_by     uuid references public.users(id) on delete set null;

create table if not exists public.calendar_integrations (
  id               uuid        primary key default gen_random_uuid(),
  clinic_id        uuid        not null references public.clinics(id) on delete cascade,
  provider         text        not null check (provider in ('google')),
  access_token     text        not null,
  refresh_token    text,
  token_expires_at timestamptz,
  calendar_id      text        not null default 'primary',
  connected_at     timestamptz not null default now(),
  connected_by     uuid        references public.users(id) on delete set null,
  unique (clinic_id, provider)
);

create index if not exists calendar_integrations_clinic_id_idx on public.calendar_integrations(clinic_id);

alter table public.calendar_integrations enable row level security;

drop policy if exists "calendar_integrations_select" on public.calendar_integrations;
create policy "calendar_integrations_select" on public.calendar_integrations
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "calendar_integrations_insert" on public.calendar_integrations;
create policy "calendar_integrations_insert" on public.calendar_integrations
  for insert to authenticated
  with check (public.can_manage_clinic(clinic_id::uuid));

drop policy if exists "calendar_integrations_update" on public.calendar_integrations;
create policy "calendar_integrations_update" on public.calendar_integrations
  for update to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));

drop policy if exists "calendar_integrations_delete" on public.calendar_integrations;
create policy "calendar_integrations_delete" on public.calendar_integrations
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));


-- ── 3. patient_exams ─────────────────────────────────────────────────────────
-- Laboratory exam records per patient.

create table if not exists public.patient_exams (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id) on delete cascade,
  patient_id  uuid        not null references public.patients(id) on delete cascade,
  exam_date   date        not null,
  lab_name    text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists patient_exams_clinic_id_idx  on public.patient_exams(clinic_id);
create index if not exists patient_exams_patient_id_idx on public.patient_exams(patient_id);

alter table public.patient_exams enable row level security;

drop policy if exists "patient_exams_select" on public.patient_exams;
create policy "patient_exams_select" on public.patient_exams
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "patient_exams_insert" on public.patient_exams;
create policy "patient_exams_insert" on public.patient_exams
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "patient_exams_update" on public.patient_exams;
create policy "patient_exams_update" on public.patient_exams
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "patient_exams_delete" on public.patient_exams;
create policy "patient_exams_delete" on public.patient_exams
  for delete to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));


-- ── 4. exam_results ────────────────────────────────────────────────────────────
-- Individual biomarker results for a patient exam.  Access is derived from patient_exams.

create table if not exists public.exam_results (
  id         uuid    primary key default gen_random_uuid(),
  exam_id    uuid    not null references public.patient_exams(id) on delete cascade,
  biomarker  text    not null,
  value      numeric not null,
  unit       text,
  ref_min    numeric,
  ref_max    numeric,
  status     text    generated always as (
    case
      when ref_min is null or ref_max is null then 'unknown'
      when value < ref_min then 'low'
      when value > ref_max then 'high'
      else 'normal'
    end
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists exam_results_exam_id_idx on public.exam_results(exam_id);

alter table public.exam_results enable row level security;

drop policy if exists "exam_results_select" on public.exam_results;
create policy "exam_results_select" on public.exam_results
  for select to authenticated
  using (
    exists (
      select 1 from public.patient_exams e
      where e.id = exam_id and public.can_access_clinic(e.clinic_id)
    )
  );

drop policy if exists "exam_results_insert" on public.exam_results;
create policy "exam_results_insert" on public.exam_results
  for insert to authenticated
  with check (
    exists (
      select 1 from public.patient_exams e
      where e.id = exam_id and public.can_write_clinic_data(e.clinic_id)
    )
  );

drop policy if exists "exam_results_update" on public.exam_results;
create policy "exam_results_update" on public.exam_results
  for update to authenticated
  using (
    exists (
      select 1 from public.patient_exams e
      where e.id = exam_id and public.can_write_clinic_data(e.clinic_id)
    )
  );

drop policy if exists "exam_results_delete" on public.exam_results;
create policy "exam_results_delete" on public.exam_results
  for delete to authenticated
  using (
    exists (
      select 1 from public.patient_exams e
      where e.id = exam_id and public.can_write_clinic_data(e.clinic_id)
    )
  );


-- ── 5. finance_insights ────────────────────────────────────────────────────────
-- Cache for AI-generated financial analysis results, keyed by clinic + period.

create table if not exists public.finance_insights (
  id            uuid        primary key default gen_random_uuid(),
  clinic_id     uuid        not null references public.clinics(id) on delete cascade,
  period_month  text        not null,
  content       jsonb       not null,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists finance_insights_clinic_generated_idx on public.finance_insights(clinic_id, generated_at desc);

alter table public.finance_insights enable row level security;

drop policy if exists "finance_insights_select" on public.finance_insights;
create policy "finance_insights_select" on public.finance_insights
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "finance_insights_insert" on public.finance_insights;
create policy "finance_insights_insert" on public.finance_insights
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "finance_insights_delete" on public.finance_insights;
create policy "finance_insights_delete" on public.finance_insights
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));


-- ── 6. hotmart_purchases ───────────────────────────────────────────────────────
-- Stores Hotmart webhook events (purchases, cancellations, refunds).

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'hotmart_purchases'
      and column_name = 'clinic_id' and data_type = 'text'
  ) then
    alter table public.hotmart_purchases alter column clinic_id type uuid using clinic_id::uuid;
  end if;
end $$;

alter table if exists public.hotmart_purchases
  add column if not exists clinic_id      uuid    references public.clinics(id) on delete cascade,
  add column if not exists patient_id     uuid    references public.patients(id) on delete set null,
  add column if not exists transaction_id text,
  add column if not exists product_id     text,
  add column if not exists product_name   text,
  add column if not exists offer_code     text,
  add column if not exists buyer_email    text,
  add column if not exists buyer_name     text,
  add column if not exists buyer_phone    text,
  add column if not exists status         text,
  add column if not exists price_cents    integer,
  add column if not exists currency       text,
  add column if not exists event_type     text,
  add column if not exists payload        jsonb,
  add column if not exists updated_at     timestamptz not null default now();

create table if not exists public.hotmart_purchases (
  id             uuid        primary key default gen_random_uuid(),
  clinic_id      uuid        not null references public.clinics(id) on delete cascade,
  patient_id     uuid        references public.patients(id) on delete set null,
  transaction_id text        not null unique,
  product_id     text,
  product_name   text,
  offer_code     text,
  buyer_email    text        not null,
  buyer_name     text,
  buyer_phone    text,
  status         text        not null default 'other'
                             check (status in ('completed', 'cancelled', 'refunded', 'chargeback', 'other')),
  price_cents    integer,
  currency       text        not null default 'BRL',
  event_type     text,
  payload        jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists hotmart_purchases_clinic_id_idx  on public.hotmart_purchases(clinic_id);
create index if not exists hotmart_purchases_patient_id_idx on public.hotmart_purchases(patient_id);
create index if not exists hotmart_purchases_status_idx     on public.hotmart_purchases(status);
create index if not exists hotmart_purchases_created_at_idx on public.hotmart_purchases(created_at desc);

drop trigger if exists set_hotmart_purchases_updated_at on public.hotmart_purchases;
create trigger set_hotmart_purchases_updated_at
before update on public.hotmart_purchases
for each row execute function public.set_updated_at();

alter table public.hotmart_purchases enable row level security;

drop policy if exists "hotmart_purchases_select" on public.hotmart_purchases;
create policy "hotmart_purchases_select" on public.hotmart_purchases
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "hotmart_purchases_insert" on public.hotmart_purchases;
create policy "hotmart_purchases_insert" on public.hotmart_purchases
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "hotmart_purchases_update" on public.hotmart_purchases;
create policy "hotmart_purchases_update" on public.hotmart_purchases
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));


-- ── 7. media ───────────────────────────────────────────────────────────────────
-- Metadata for files stored in Supabase Storage (voice notes, images, etc.).

create table if not exists public.media (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id) on delete cascade,
  bucket      text        not null default 'media',
  file_path   text        not null,
  file_name   text        not null,
  mime_type   text,
  file_size   bigint,
  public_url  text,
  entity_type text,
  entity_id   uuid,
  uploaded_by uuid        references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists media_clinic_id_idx   on public.media(clinic_id);
create index if not exists media_entity_idx      on public.media(entity_type, entity_id);

alter table public.media enable row level security;

drop policy if exists "media_select" on public.media;
create policy "media_select" on public.media
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "media_insert" on public.media;
create policy "media_insert" on public.media
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "media_delete" on public.media;
create policy "media_delete" on public.media
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));


-- ── 8. meta_conversations ──────────────────────────────────────────────────────
-- Conversation threads received via Meta (WhatsApp Business API / Messenger).

alter table if exists public.meta_conversations
  add column if not exists clinic_id         uuid    references public.clinics(id) on delete cascade,
  add column if not exists phone             text,
  add column if not exists platform          text,
  add column if not exists messages          jsonb,
  add column if not exists linked_patient_id uuid    references public.patients(id) on delete set null,
  add column if not exists linked_lead_id    uuid    references public.leads(id) on delete set null,
  add column if not exists bot_disabled      boolean,
  add column if not exists handled_by_human  boolean,
  add column if not exists handled_by_name   text,
  add column if not exists updated_at        timestamptz not null default now();

create table if not exists public.meta_conversations (
  id                uuid        primary key default gen_random_uuid(),
  clinic_id         uuid        not null references public.clinics(id) on delete cascade,
  phone             text        not null,
  platform          text        not null default 'whatsapp' check (platform in ('whatsapp', 'messenger')),
  messages          jsonb       not null default '[]'::jsonb,
  linked_patient_id uuid        references public.patients(id) on delete set null,
  linked_lead_id    uuid        references public.leads(id)    on delete set null,
  bot_disabled      boolean     not null default false,
  handled_by_human  boolean     not null default false,
  handled_by_name   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (clinic_id, phone, platform)
);

create index if not exists meta_conversations_clinic_id_idx on public.meta_conversations(clinic_id);
create index if not exists meta_conversations_phone_idx     on public.meta_conversations(phone);

drop trigger if exists set_meta_conversations_updated_at on public.meta_conversations;
create trigger set_meta_conversations_updated_at
before update on public.meta_conversations
for each row execute function public.set_updated_at();

alter table public.meta_conversations enable row level security;

drop policy if exists "meta_conversations_select" on public.meta_conversations;
create policy "meta_conversations_select" on public.meta_conversations
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "meta_conversations_insert" on public.meta_conversations;
create policy "meta_conversations_insert" on public.meta_conversations
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "meta_conversations_update" on public.meta_conversations;
create policy "meta_conversations_update" on public.meta_conversations
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));


-- ── 9. patient_payments ──────────────────────────────────────────────────────
-- Individual payment records linked to a patient and optionally to an appointment
-- or patient_offer (package/membership purchase).

alter table if exists public.patient_payments
  add column if not exists clinic_id                uuid    references public.clinics(id) on delete cascade,
  add column if not exists patient_id               uuid    references public.patients(id) on delete cascade,
  add column if not exists appointment_id           uuid    references public.appointments(id) on delete set null,
  add column if not exists patient_offer_id         uuid    references public.patient_offers(id) on delete set null,
  add column if not exists amount_cents             integer,
  add column if not exists currency                 text,
  add column if not exists payment_method           text,
  add column if not exists status                   text,
  add column if not exists paid_at                  timestamptz,
  add column if not exists notes                    text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists refunded_at              timestamptz,
  add column if not exists refund_amount_cents      integer,
  add column if not exists created_by               uuid    references public.users(id) on delete set null;

create table if not exists public.patient_payments (
  id                        uuid        primary key default gen_random_uuid(),
  clinic_id                 uuid        not null references public.clinics(id) on delete cascade,
  patient_id                uuid        not null references public.patients(id) on delete cascade,
  appointment_id            uuid        references public.appointments(id) on delete set null,
  patient_offer_id          uuid        references public.patient_offers(id) on delete set null,
  amount_cents              integer     not null check (amount_cents >= 0),
  currency                  text        not null default 'BRL',
  payment_method            text        check (payment_method in ('pix', 'credit_card', 'debit_card', 'cash', 'transfer', 'insurance', 'other')),
  status                    text        not null default 'paid'
                                        check (status in ('paid', 'refunded', 'partially_refunded', 'failed')),
  paid_at                   timestamptz not null default now(),
  notes                     text,
  stripe_payment_intent_id  text,
  refunded_at               timestamptz,
  refund_amount_cents       integer,
  created_by                uuid        references public.users(id) on delete set null,
  created_at                timestamptz not null default now()
);

create index if not exists patient_payments_clinic_id_idx   on public.patient_payments(clinic_id);
create index if not exists patient_payments_patient_id_idx  on public.patient_payments(patient_id);
create index if not exists patient_payments_paid_at_idx     on public.patient_payments(paid_at desc);
create index if not exists patient_payments_status_idx      on public.patient_payments(status);

alter table public.patient_payments enable row level security;

drop policy if exists "patient_payments_select" on public.patient_payments;
create policy "patient_payments_select" on public.patient_payments
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "patient_payments_insert" on public.patient_payments;
create policy "patient_payments_insert" on public.patient_payments
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "patient_payments_update" on public.patient_payments;
create policy "patient_payments_update" on public.patient_payments
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "patient_payments_delete" on public.patient_payments;
create policy "patient_payments_delete" on public.patient_payments
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));


-- ── 10. nfse_invoices ───────────────────────────────────────────────────────────
-- NFS-e (Nota Fiscal de Serviços Eletrônica) issued via NFe.io per clinic payment.

create table if not exists public.nfse_invoices (
  id                  uuid        primary key default gen_random_uuid(),
  clinic_id           uuid        not null references public.clinics(id) on delete cascade,
  patient_payment_id  uuid        references public.patient_payments(id) on delete set null,
  patient_id          uuid        references public.patients(id) on delete set null,
  nfse_external_id    text,
  nfse_number         text,
  nfse_series         text,
  nfse_check_code     text,
  status              text        not null default 'processing'
                                  check (status in ('processing', 'issued', 'cancelled', 'error')),
  error_message       text,
  amount_cents        integer     not null default 0,
  borrower_name       text,
  borrower_cpf        text,
  service_description text,
  pdf_url             text,
  xml_url             text,
  issued_at           timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists nfse_invoices_clinic_id_idx         on public.nfse_invoices(clinic_id);
create index if not exists nfse_invoices_patient_payment_id_idx on public.nfse_invoices(patient_payment_id);
create index if not exists nfse_invoices_status_idx            on public.nfse_invoices(status);
create index if not exists nfse_invoices_created_at_idx        on public.nfse_invoices(created_at desc);

alter table public.nfse_invoices enable row level security;

drop policy if exists "nfse_invoices_select" on public.nfse_invoices;
create policy "nfse_invoices_select" on public.nfse_invoices
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "nfse_invoices_insert" on public.nfse_invoices;
create policy "nfse_invoices_insert" on public.nfse_invoices
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "nfse_invoices_update" on public.nfse_invoices;
create policy "nfse_invoices_update" on public.nfse_invoices
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "nfse_invoices_delete" on public.nfse_invoices;
create policy "nfse_invoices_delete" on public.nfse_invoices
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));


-- ── 11. patient_documents ──────────────────────────────────────────────────────
-- Metadata for files uploaded per patient (PDFs, images, etc.) stored in Storage.

create table if not exists public.patient_documents (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id) on delete cascade,
  patient_id  uuid        not null references public.patients(id) on delete cascade,
  file_name   text        not null,
  file_path   text        not null,
  file_type   text        not null default 'other'
              check (file_type in ('pdf', 'image', 'text', 'other')),
  file_size   bigint,
  source      text        not null default 'clinic'
              check (source in ('clinic', 'intake', 'portal')),
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists patient_documents_clinic_id_idx  on public.patient_documents(clinic_id);
create index if not exists patient_documents_patient_id_idx on public.patient_documents(patient_id);

alter table public.patient_documents enable row level security;

drop policy if exists "patient_documents_select" on public.patient_documents;
create policy "patient_documents_select" on public.patient_documents
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "patient_documents_insert" on public.patient_documents;
create policy "patient_documents_insert" on public.patient_documents
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "patient_documents_delete" on public.patient_documents;
create policy "patient_documents_delete" on public.patient_documents
  for delete to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));


-- ── 12. patient_packages ──────────────────────────────────────────────────────
-- Session packages assigned to a patient (name, total sessions, start date).

create table if not exists public.patient_packages (
  id              uuid        primary key default gen_random_uuid(),
  clinic_id       uuid        not null references public.clinics(id) on delete cascade,
  patient_id      uuid        not null references public.patients(id) on delete cascade,
  name            text        not null,
  sessions_total  integer     not null check (sessions_total > 0),
  start_date      date        not null default current_date,
  notes           text,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists patient_packages_clinic_id_idx  on public.patient_packages(clinic_id);
create index if not exists patient_packages_patient_id_idx on public.patient_packages(patient_id);

alter table public.patient_packages enable row level security;

drop policy if exists "patient_packages_select" on public.patient_packages;
create policy "patient_packages_select" on public.patient_packages
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "patient_packages_insert" on public.patient_packages;
create policy "patient_packages_insert" on public.patient_packages
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "patient_packages_update" on public.patient_packages;
create policy "patient_packages_update" on public.patient_packages
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "patient_packages_delete" on public.patient_packages;
create policy "patient_packages_delete" on public.patient_packages
  for delete to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));


-- ── 13. patient_prescriptions ─────────────────────────────────────────────────
-- Medication and supplement prescriptions for a patient.

create table if not exists public.patient_prescriptions (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id) on delete cascade,
  patient_id  uuid        not null references public.patients(id) on delete cascade,
  type        text        not null default 'supplement'
              check (type in ('medication', 'supplement')),
  name        text        not null,
  dosage      text,
  frequency   text,
  start_date  date,
  end_date    date,
  is_active   boolean     not null default true,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists patient_prescriptions_clinic_id_idx  on public.patient_prescriptions(clinic_id);
create index if not exists patient_prescriptions_patient_id_idx on public.patient_prescriptions(patient_id);

alter table public.patient_prescriptions enable row level security;

drop policy if exists "patient_prescriptions_select" on public.patient_prescriptions;
create policy "patient_prescriptions_select" on public.patient_prescriptions
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "patient_prescriptions_insert" on public.patient_prescriptions;
create policy "patient_prescriptions_insert" on public.patient_prescriptions
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "patient_prescriptions_update" on public.patient_prescriptions;
create policy "patient_prescriptions_update" on public.patient_prescriptions
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "patient_prescriptions_delete" on public.patient_prescriptions;
create policy "patient_prescriptions_delete" on public.patient_prescriptions
  for delete to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));


-- ── 14. product_orders ────────────────────────────────────────────────────────
-- Clinic product orders linked to a patient.

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

create index if not exists product_orders_clinic_id_idx on public.product_orders(clinic_id);
create index if not exists product_orders_patient_id_idx on public.product_orders(patient_id);
create index if not exists product_orders_status_idx    on public.product_orders(status);

drop trigger if exists set_product_orders_updated_at on public.product_orders;
create trigger set_product_orders_updated_at
before update on public.product_orders
for each row execute function public.set_updated_at();

alter table public.product_orders enable row level security;

drop policy if exists "product_orders_select" on public.product_orders;
create policy "product_orders_select" on public.product_orders
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "product_orders_insert" on public.product_orders;
create policy "product_orders_insert" on public.product_orders
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "product_orders_update" on public.product_orders;
create policy "product_orders_update" on public.product_orders
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "product_orders_delete" on public.product_orders;
create policy "product_orders_delete" on public.product_orders
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));


-- ── 15. repasse_ledger ────────────────────────────────────────────────────────
-- Monthly revenue-sharing ledger entries per professional per clinic.

create table if not exists public.repasse_ledger (
  id                  uuid        primary key default gen_random_uuid(),
  clinic_id           uuid        not null references public.clinics(id) on delete cascade,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  period_month        text        not null,
  sessions_count      integer     not null default 0,
  gross_revenue_cents integer     not null default 0,
  repasse_cents       integer     not null default 0,
  status              text        not null default 'pending'
                                  check (status in ('pending', 'paid')),
  paid_at             timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (clinic_id, user_id, period_month)
);

create index if not exists repasse_ledger_clinic_month_idx on public.repasse_ledger(clinic_id, period_month desc);

drop trigger if exists set_repasse_ledger_updated_at on public.repasse_ledger;
create trigger set_repasse_ledger_updated_at
before update on public.repasse_ledger
for each row execute function public.set_updated_at();

alter table public.repasse_ledger enable row level security;

drop policy if exists "repasse_ledger_select" on public.repasse_ledger;
create policy "repasse_ledger_select" on public.repasse_ledger
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "repasse_ledger_all" on public.repasse_ledger;
create policy "repasse_ledger_all" on public.repasse_ledger
  for all to authenticated
  using (public.can_manage_clinic(clinic_id::uuid))
  with check (public.can_manage_clinic(clinic_id::uuid));


-- ── 16. repasse_rules ─────────────────────────────────────────────────────────
-- Revenue-sharing percentage rules per professional per clinic.

create table if not exists public.repasse_rules (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  percentage  numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create index if not exists repasse_rules_clinic_id_idx on public.repasse_rules(clinic_id);

drop trigger if exists set_repasse_rules_updated_at on public.repasse_rules;
create trigger set_repasse_rules_updated_at
before update on public.repasse_rules
for each row execute function public.set_updated_at();

alter table public.repasse_rules enable row level security;

drop policy if exists "repasse_rules_select" on public.repasse_rules;
create policy "repasse_rules_select" on public.repasse_rules
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "repasse_rules_all" on public.repasse_rules;
create policy "repasse_rules_all" on public.repasse_rules
  for all to authenticated
  using (public.can_manage_clinic(clinic_id::uuid))
  with check (public.can_manage_clinic(clinic_id::uuid));


-- ── 17. security_rls_status ───────────────────────────────────────────────────
-- Read-only view exposing pg_tables RLS flags for the public schema.
-- Used by the security audit screen in the platform admin panel.

create or replace view public.security_rls_status as
select
  t.schemaname,
  t.tablename,
  t.rowsecurity                as rls_enabled,
  c.relforcerowsecurity        as rls_forced
from pg_tables t
join pg_class c
  on c.relname = t.tablename
 and c.relnamespace = (select oid from pg_namespace where nspname = t.schemaname)
where t.schemaname = 'public'
order by t.tablename;

alter view public.security_rls_status set (security_barrier = true);

grant select on public.security_rls_status to authenticated;


-- ── 18. treatment_plans ───────────────────────────────────────────────────────
-- Treatment plans per patient with goal, status, and date range.

create table if not exists public.treatment_plans (
  id             uuid        primary key default gen_random_uuid(),
  clinic_id      uuid        not null references public.clinics(id) on delete cascade,
  patient_id     uuid        not null references public.patients(id) on delete cascade,
  created_by     uuid        references public.users(id) on delete set null,
  title          text        not null,
  goal           text,
  status         text        not null default 'active'
                             check (status in ('active', 'paused', 'completed', 'cancelled')),
  started_at     date,
  target_end_at  date,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists treatment_plans_clinic_id_idx  on public.treatment_plans(clinic_id);
create index if not exists treatment_plans_patient_id_idx on public.treatment_plans(patient_id);

drop trigger if exists set_treatment_plans_updated_at on public.treatment_plans;
create trigger set_treatment_plans_updated_at
before update on public.treatment_plans
for each row execute function public.set_updated_at();

alter table public.treatment_plans enable row level security;

drop policy if exists "treatment_plans_select" on public.treatment_plans;
create policy "treatment_plans_select" on public.treatment_plans
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "treatment_plans_insert" on public.treatment_plans;
create policy "treatment_plans_insert" on public.treatment_plans
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "treatment_plans_update" on public.treatment_plans;
create policy "treatment_plans_update" on public.treatment_plans
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "treatment_plans_delete" on public.treatment_plans;
create policy "treatment_plans_delete" on public.treatment_plans
  for delete to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));


-- ── 19. treatment_plan_steps ──────────────────────────────────────────────────
-- Individual steps belonging to a treatment plan.

create table if not exists public.treatment_plan_steps (
  id            uuid        primary key default gen_random_uuid(),
  clinic_id     uuid        not null references public.clinics(id) on delete cascade,
  plan_id       uuid        not null references public.treatment_plans(id) on delete cascade,
  title         text        not null,
  description   text,
  order_index   integer     not null default 0,
  is_completed  boolean     not null default false,
  completed_at  timestamptz,
  due_date      date,
  created_at    timestamptz not null default now()
);

create index if not exists treatment_plan_steps_plan_id_idx    on public.treatment_plan_steps(plan_id);
create index if not exists treatment_plan_steps_clinic_id_idx  on public.treatment_plan_steps(clinic_id);

alter table public.treatment_plan_steps enable row level security;

drop policy if exists "treatment_steps_select" on public.treatment_plan_steps;
create policy "treatment_steps_select" on public.treatment_plan_steps
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "treatment_steps_insert" on public.treatment_plan_steps;
create policy "treatment_steps_insert" on public.treatment_plan_steps
  for insert to authenticated
  with check (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "treatment_steps_update" on public.treatment_plan_steps;
create policy "treatment_steps_update" on public.treatment_plan_steps
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));

drop policy if exists "treatment_steps_delete" on public.treatment_plan_steps;
create policy "treatment_steps_delete" on public.treatment_plan_steps
  for delete to authenticated
  using (public.can_write_clinic_data(clinic_id::uuid));


-- ── 20. whatsapp_bot_configs ──────────────────────────────────────────────────
-- WhatsApp bot configuration per clinic (Twilio number, persona, pricing, etc.).

create table if not exists public.whatsapp_bot_configs (
  id                   uuid        primary key default gen_random_uuid(),
  clinic_id            uuid        not null references public.clinics(id) on delete cascade unique,
  twilio_number        text        unique,
  professional_name    text        not null default '',
  clinic_name          text        not null default '',
  specialty            text        not null default '',
  methodology          text        not null default '',
  locations            jsonb       not null default '[]'::jsonb,
  language             text        not null default 'pt-BR',
  custom_instructions  text        not null default '',
  is_active            boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists whatsapp_bot_configs_clinic_id_idx on public.whatsapp_bot_configs(clinic_id);

drop trigger if exists set_whatsapp_bot_configs_updated_at on public.whatsapp_bot_configs;
create trigger set_whatsapp_bot_configs_updated_at
before update on public.whatsapp_bot_configs
for each row execute function public.set_updated_at();

alter table public.whatsapp_bot_configs enable row level security;

drop policy if exists "whatsapp_bot_configs_select" on public.whatsapp_bot_configs;
create policy "whatsapp_bot_configs_select" on public.whatsapp_bot_configs
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "whatsapp_bot_configs_insert" on public.whatsapp_bot_configs;
create policy "whatsapp_bot_configs_insert" on public.whatsapp_bot_configs
  for insert to authenticated
  with check (public.can_manage_clinic(clinic_id::uuid));

drop policy if exists "whatsapp_bot_configs_update" on public.whatsapp_bot_configs;
create policy "whatsapp_bot_configs_update" on public.whatsapp_bot_configs
  for update to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));

drop policy if exists "whatsapp_bot_configs_delete" on public.whatsapp_bot_configs;
create policy "whatsapp_bot_configs_delete" on public.whatsapp_bot_configs
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));


-- ── 21. whatsapp_conversations ────────────────────────────────────────────────
-- WhatsApp conversation threads per phone number, with entity linking and
-- human-takeover flags.
-- NOTE: table may already exist from manual creation — add missing columns safely.

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'whatsapp_conversations'
      and column_name = 'clinic_id' and data_type = 'text'
  ) then
    alter table public.whatsapp_conversations alter column clinic_id type uuid using clinic_id::uuid;
  end if;
end $$;

alter table if exists public.whatsapp_conversations
  add column if not exists clinic_id         uuid        references public.clinics(id) on delete cascade,
  add column if not exists linked_patient_id uuid        references public.patients(id) on delete set null,
  add column if not exists linked_lead_id    uuid        references public.leads(id)    on delete set null,
  add column if not exists bot_disabled      boolean     not null default false,
  add column if not exists handled_by_human  boolean     not null default false,
  add column if not exists handled_by_name   text,
  add column if not exists messages          jsonb       not null default '[]'::jsonb,
  add column if not exists updated_at        timestamptz not null default now();

create table if not exists public.whatsapp_conversations (
  id                uuid        primary key default gen_random_uuid(),
  phone             text        not null unique,
  clinic_id         uuid        references public.clinics(id) on delete cascade,
  messages          jsonb       not null default '[]'::jsonb,
  linked_patient_id uuid        references public.patients(id) on delete set null,
  linked_lead_id    uuid        references public.leads(id)    on delete set null,
  bot_disabled      boolean     not null default false,
  handled_by_human  boolean     not null default false,
  handled_by_name   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists whatsapp_conversations_clinic_id_idx on public.whatsapp_conversations(clinic_id);
create index if not exists whatsapp_conversations_phone_idx     on public.whatsapp_conversations(phone);

drop trigger if exists set_whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger set_whatsapp_conversations_updated_at
before update on public.whatsapp_conversations
for each row execute function public.set_updated_at();

alter table public.whatsapp_conversations enable row level security;

drop policy if exists "whatsapp_conversations_select" on public.whatsapp_conversations;
create policy "whatsapp_conversations_select" on public.whatsapp_conversations
  for select to authenticated
  using (
    clinic_id is null
    or public.can_access_clinic(clinic_id)
  );

drop policy if exists "whatsapp_conversations_insert" on public.whatsapp_conversations;
create policy "whatsapp_conversations_insert" on public.whatsapp_conversations
  for insert to service_role
  with check (true);

drop policy if exists "whatsapp_conversations_update" on public.whatsapp_conversations;
create policy "whatsapp_conversations_update" on public.whatsapp_conversations
  for update to authenticated
  using (
    clinic_id is null
    or public.can_write_clinic_data(clinic_id)
  );


-- ── 22. zoom_recordings ───────────────────────────────────────────────────────
-- Zoom cloud recording metadata received via webhook per meeting/appointment.
-- NOTE: table may already exist from manual creation — add missing columns safely.

-- Convert clinic_id from text to uuid if it exists as text type
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'zoom_recordings'
      and column_name  = 'clinic_id'
      and data_type    = 'text'
  ) then
    alter table public.zoom_recordings
      alter column clinic_id type uuid using clinic_id::uuid;
  end if;
end $$;

alter table if exists public.zoom_recordings
  add column if not exists clinic_id       uuid        references public.clinics(id) on delete cascade,
  add column if not exists appointment_id  uuid        references public.appointments(id) on delete set null,
  add column if not exists patient_id      uuid        references public.patients(id) on delete set null,
  add column if not exists zoom_meeting_id text,
  add column if not exists recording_id    text,
  add column if not exists file_type       text,
  add column if not exists file_size       bigint,
  add column if not exists play_url        text,
  add column if not exists download_url    text,
  add column if not exists recording_start timestamptz,
  add column if not exists recording_end   timestamptz,
  add column if not exists status          text;

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
  for select to authenticated
  using (public.can_access_clinic(clinic_id::uuid));

drop policy if exists "zoom_recordings_insert" on public.zoom_recordings;
create policy "zoom_recordings_insert" on public.zoom_recordings
  for insert to service_role
  with check (true);

drop policy if exists "zoom_recordings_delete" on public.zoom_recordings;
create policy "zoom_recordings_delete" on public.zoom_recordings
  for delete to authenticated
  using (public.can_manage_clinic(clinic_id::uuid));
