-- 093_neuro_id_question_map.sql
-- §8 Bio³: de-para questionário → pilar (alimenta o Mapa Bio³ automaticamente).
-- Setup 1x por template (por clínica). Mapeia por TEMPLATE + SEÇÃO (MSQ/HPA) ou
-- por TOTAL do template (PHQ-9/GAD-7) — robusto e independente de UUID por clínica.
-- ⚠️ NÃO aplicada automaticamente — aguardando OK do Marcelo.

create table if not exists public.neuro_id_question_map (
  id            uuid        primary key default gen_random_uuid(),
  clinic_id     uuid        not null references public.clinics(id) on delete cascade,
  source        text        not null default 'assessment',  -- 'assessment' | 'intake'
  template_match text       not null,                        -- substring do nome do template (ex.: 'MSQ', 'PHQ-9')
  section_match text,                                        -- substring do título da seção; null = total do template
  catalog_code  text        not null,                        -- code do assessment_items_catalog (pilar destino)
  norm_min      numeric     not null default 0,
  norm_max      numeric,                                     -- null = usar o máximo computado da fonte
  weight        numeric     not null default 1,
  active        boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (clinic_id, template_match, section_match, catalog_code)
);
create index if not exists niqm_clinic_idx on public.neuro_id_question_map (clinic_id, active);

alter table public.neuro_id_question_map enable row level security;
drop policy if exists "niqm_select" on public.neuro_id_question_map;
create policy "niqm_select" on public.neuro_id_question_map for select using (public.can_access_clinic(clinic_id));
drop policy if exists "niqm_insert" on public.neuro_id_question_map;
create policy "niqm_insert" on public.neuro_id_question_map for insert with check (public.can_write_clinic_data(clinic_id));
drop policy if exists "niqm_update" on public.neuro_id_question_map;
create policy "niqm_update" on public.neuro_id_question_map for update using (public.can_write_clinic_data(clinic_id));
drop policy if exists "niqm_delete" on public.neuro_id_question_map;
create policy "niqm_delete" on public.neuro_id_question_map for delete using (public.can_write_clinic_data(clinic_id));

notify pgrst, 'reload schema';
