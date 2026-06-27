-- 106_clinic_patient_sections.sql
-- Ordem e visibilidade das SEÇÕES da ficha do paciente, por clínica.
--
-- Antes a página /patients/[id] tinha ~17 seções em ordem fixa no JSX. Agora cada
-- clínica define a ordem (order_index) e se a seção aparece (is_visible) em
-- /settings/personalizar. A página renderiza pelas prefs; seções condicionais
-- (financeiro, indicação, relatórios) só aparecem quando há dado, respeitando a pref.
--
-- RLS multi-tenant por clinic_id (helpers can_access_clinic / can_write_clinic_data,
-- iguais às migrations 088/101). Aditivo e idempotente.

create table if not exists public.clinic_patient_sections (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id) on delete cascade,
  section_key text        not null,        -- slug estável da seção (ver lib/patient-sections.ts)
  order_index integer     not null default 0,
  is_visible  boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (clinic_id, section_key)
);
create index if not exists clinic_patient_sections_clinic_idx
  on public.clinic_patient_sections (clinic_id, order_index);

alter table public.clinic_patient_sections enable row level security;
drop policy if exists "cps_select" on public.clinic_patient_sections;
create policy "cps_select" on public.clinic_patient_sections
  for select using (public.can_access_clinic(clinic_id));
drop policy if exists "cps_insert" on public.clinic_patient_sections;
create policy "cps_insert" on public.clinic_patient_sections
  for insert with check (public.can_write_clinic_data(clinic_id));
drop policy if exists "cps_update" on public.clinic_patient_sections;
create policy "cps_update" on public.clinic_patient_sections
  for update using (public.can_write_clinic_data(clinic_id));
drop policy if exists "cps_delete" on public.clinic_patient_sections;
create policy "cps_delete" on public.clinic_patient_sections
  for delete using (public.can_write_clinic_data(clinic_id));

-- Seed da ordem padrão (= ordem atual do JSX) para clínicas existentes.
insert into public.clinic_patient_sections (clinic_id, section_key, order_index)
select c.id, s.section_key, s.order_index
from public.clinics c
cross join (values
  ('avaliacao',          0),
  ('resumo',             1),
  ('acompanhamento',     2),
  ('indicacao',          3),
  ('mapa_bio3',          4),
  ('resumo_rapido',      5),
  ('relatorios',         6),
  ('proximo_passo',      7),
  ('jornada',            8),
  ('nota_voz',           9),
  ('plano_suplementos',  10),
  ('pacotes',            11),
  ('cobranca',           12),
  ('financeiro',         13),
  ('exames',             14),
  ('medicamentos',       15),
  ('documentos',         16)
) as s(section_key, order_index)
on conflict (clinic_id, section_key) do nothing;

notify pgrst, 'reload schema';
