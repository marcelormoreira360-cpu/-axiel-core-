-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009 — RLS, index, and schema fixes
--
-- DB-01: remove clinic_id IS NULL branch from whatsapp_conversations policies
--        so orphaned rows can't be read by any authenticated user
-- DB-02: add updated_at column + trigger to patient_packages
-- DB-05: add index on repasse_ledger.user_id for practitioner-scoped queries
-- ─────────────────────────────────────────────────────────────────────────────


-- ── DB-01: tighten whatsapp_conversations RLS ─────────────────────────────────

drop policy if exists "whatsapp_conversations_select" on public.whatsapp_conversations;
create policy "whatsapp_conversations_select" on public.whatsapp_conversations
  for select to authenticated
  using (public.can_access_clinic(clinic_id));

drop policy if exists "whatsapp_conversations_update" on public.whatsapp_conversations;
create policy "whatsapp_conversations_update" on public.whatsapp_conversations
  for update to authenticated
  using (public.can_write_clinic_data(clinic_id));


-- ── DB-02: updated_at on patient_packages ─────────────────────────────────────

alter table public.patient_packages
  add column if not exists updated_at timestamptz not null default now();

-- Backfill existing rows
update public.patient_packages set updated_at = created_at where updated_at = now();

drop trigger if exists set_patient_packages_updated_at on public.patient_packages;
create trigger set_patient_packages_updated_at
  before update on public.patient_packages
  for each row execute function public.set_updated_at();


-- ── DB-05: index on repasse_ledger.user_id ────────────────────────────────────

create index if not exists repasse_ledger_user_id_idx
  on public.repasse_ledger(user_id);
