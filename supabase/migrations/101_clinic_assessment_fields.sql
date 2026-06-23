-- 101_clinic_assessment_fields.sql
-- Avaliação editável por clínica: cada clínica define os campos do painel "Avaliação"
-- (espaço do terapeuta que alimenta o relatório). Antes eram 5 colunas fixas em patients
-- (anamnese, antecedents, pain_level, pain_location, treatment_note).
--
-- Agora:
--   1) clinic_assessment_fields  → definição dos campos por clínica (editável em /settings)
--   2) patients.assessment_data  → respostas do paciente em JSONB ({field_key: valor})
--
-- As 5 colunas legadas continuam existindo (não derrubadas) para compatibilidade/rollback;
-- o app passa a ler/gravar via assessment_data. RLS multi-tenant por clinic_id
-- (helpers can_access_clinic / can_write_clinic_data, iguais à migration 088).

-- ── Definição de campos por clínica ──────────────────────────────────────────
create table if not exists public.clinic_assessment_fields (
  id                uuid        primary key default gen_random_uuid(),
  clinic_id         uuid        not null references public.clinics(id) on delete cascade,
  field_key         text        not null,            -- slug estável usado como chave no JSONB
  label             text        not null,
  field_type        text        not null default 'textarea'
                    check (field_type in ('textarea','text','number','select')),
  placeholder       text,
  help_text         text,
  options           jsonb,                            -- select: {"choices":[...]}; number: {"min":0,"max":10}
  order_index       integer     not null default 0,
  is_active         boolean     not null default true,
  include_in_report boolean     not null default true, -- entra no relatório IA (Doc 1)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (clinic_id, field_key)
);
create index if not exists clinic_assessment_fields_clinic_idx
  on public.clinic_assessment_fields (clinic_id, order_index);

alter table public.clinic_assessment_fields enable row level security;
drop policy if exists "caf_select" on public.clinic_assessment_fields;
create policy "caf_select" on public.clinic_assessment_fields
  for select using (public.can_access_clinic(clinic_id));
drop policy if exists "caf_insert" on public.clinic_assessment_fields;
create policy "caf_insert" on public.clinic_assessment_fields
  for insert with check (public.can_write_clinic_data(clinic_id));
drop policy if exists "caf_update" on public.clinic_assessment_fields;
create policy "caf_update" on public.clinic_assessment_fields
  for update using (public.can_write_clinic_data(clinic_id));
drop policy if exists "caf_delete" on public.clinic_assessment_fields;
create policy "caf_delete" on public.clinic_assessment_fields
  for delete using (public.can_write_clinic_data(clinic_id));

-- ── Respostas do paciente (JSONB) ────────────────────────────────────────────
alter table public.patients
  add column if not exists assessment_data jsonb not null default '{}'::jsonb;

-- Backfill: leva os 5 campos legados para assessment_data (só nos que ainda estão vazios).
update public.patients p
set assessment_data = jsonb_strip_nulls(jsonb_build_object(
  'anamnese',       p.anamnese,
  'antecedents',    p.antecedents,
  'pain_level',     p.pain_level,
  'pain_location',  p.pain_location,
  'treatment_note', p.treatment_note
))
where p.assessment_data = '{}'::jsonb;

-- ── Seed dos campos padrão para clínicas que ainda não têm nenhum ────────────
insert into public.clinic_assessment_fields
  (clinic_id, field_key, label, field_type, placeholder, options, order_index, include_in_report)
select c.id, d.field_key, d.label, d.field_type, d.placeholder, d.options, d.order_index, d.include_in_report
from public.clinics c
cross join (values
  ('anamnese',       'Anamnese',                      'textarea', 'Como o paciente está, queixa, história de vida, hábitos...',                     null::jsonb,                0, true),
  ('antecedents',    'Antecedentes / cirurgias',      'textarea', 'Cirurgias, doenças prévias e histórico relevante (o que não vem dos questionários).', null::jsonb,             1, true),
  ('pain_level',     'Grau da dor (0–10)',            'number',   null,                                                                            '{"min":0,"max":10}'::jsonb, 2, true),
  ('pain_location',  'Local da dor',                  'text',     'Ex: torácica alta, lombar, ombro direito...',                                   null::jsonb,                3, true),
  ('treatment_note', 'Conduta / tratamento sugerido', 'textarea', 'Tratamento realizado e a sugestão que vai no 1º relatório do paciente.',         null::jsonb,                4, true)
) as d(field_key, label, field_type, placeholder, options, order_index, include_in_report)
where not exists (
  select 1 from public.clinic_assessment_fields f where f.clinic_id = c.id
);

notify pgrst, 'reload schema';
