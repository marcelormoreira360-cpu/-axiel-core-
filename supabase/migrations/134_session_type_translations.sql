-- 134_session_type_translations.sql
-- Traduções dos NOMES dos tipos de sessão (serviços) por idioma, por clínica.
--
-- Motivação: o nome do serviço (session_types.name) é guardado num idioma só.
-- No agendamento público (/book) e na página de confirmação, um paciente em
-- inglês via a interface em inglês mas os serviços em português ("Avaliação",
-- "Consulta Inicial"). Esta tabela guarda o nome por locale; o nome base em
-- session_types.name continua sendo o fallback (idioma padrão da clínica).
--
-- Não há SEED: session_types.name segue como fallback. A clínica adiciona as
-- traduções (en / pt-PT) em /settings/session-types.
--
-- RLS multi-tenant por clinic_id (helpers can_access_clinic / can_write_clinic_data,
-- iguais às migrations 088/101/106). A leitura pública do booking é feita pelo
-- admin client (bypassa RLS). Aditivo e idempotente.

create table if not exists public.session_type_translations (
  id              uuid        primary key default gen_random_uuid(),
  session_type_id uuid        not null references public.session_types(id) on delete cascade,
  clinic_id       uuid        not null references public.clinics(id) on delete cascade,
  locale          text        not null check (locale in ('pt-BR', 'en', 'pt-PT')),
  name            text        not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (session_type_id, locale)
);
create index if not exists session_type_translations_stid_idx
  on public.session_type_translations (session_type_id);
create index if not exists session_type_translations_clinic_idx
  on public.session_type_translations (clinic_id);

drop trigger if exists set_session_type_translations_updated_at on public.session_type_translations;
create trigger set_session_type_translations_updated_at
before update on public.session_type_translations
for each row execute function public.set_updated_at();

alter table public.session_type_translations enable row level security;

drop policy if exists "stt_select" on public.session_type_translations;
create policy "stt_select" on public.session_type_translations
  for select using (public.can_access_clinic(clinic_id));
drop policy if exists "stt_insert" on public.session_type_translations;
create policy "stt_insert" on public.session_type_translations
  for insert with check (public.can_write_clinic_data(clinic_id));
drop policy if exists "stt_update" on public.session_type_translations;
create policy "stt_update" on public.session_type_translations
  for update using (public.can_write_clinic_data(clinic_id));
drop policy if exists "stt_delete" on public.session_type_translations;
create policy "stt_delete" on public.session_type_translations
  for delete using (public.can_write_clinic_data(clinic_id));

notify pgrst, 'reload schema';
