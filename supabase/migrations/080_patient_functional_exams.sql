-- Migration 080: exames funcionais (Neuro ID 360 — Fase 1)
-- Onde o profissional registra resultados de neurometria, biorressonância etc.
-- A IA (Mapa Integrativo + Plano de Regulação) lê desta tabela.

create table if not exists public.patient_functional_exams (
  id          uuid        primary key default gen_random_uuid(),
  clinic_id   uuid        not null references public.clinics(id)  on delete cascade,
  patient_id  uuid        not null references public.patients(id) on delete cascade,
  exam_type   text        not null,                 -- 'neurometria' | 'biorressonancia' | 'outro'
  title       text,                                 -- nome custom (quando 'outro')
  summary     text,                                 -- principais achados (texto livre)
  findings    jsonb,                                -- estruturado opcional
  exam_date   date        not null default current_date,
  created_by  uuid        references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists patient_functional_exams_patient_idx
  on public.patient_functional_exams (patient_id, exam_date desc);
create index if not exists patient_functional_exams_clinic_idx
  on public.patient_functional_exams (clinic_id);

alter table public.patient_functional_exams enable row level security;

drop policy if exists "patient_functional_exams_select" on public.patient_functional_exams;
create policy "patient_functional_exams_select" on public.patient_functional_exams
  for select using (public.can_access_clinic(clinic_id));

drop policy if exists "patient_functional_exams_insert" on public.patient_functional_exams;
create policy "patient_functional_exams_insert" on public.patient_functional_exams
  for insert with check (public.can_write_clinic_data(clinic_id));

drop policy if exists "patient_functional_exams_update" on public.patient_functional_exams;
create policy "patient_functional_exams_update" on public.patient_functional_exams
  for update using (public.can_write_clinic_data(clinic_id));

drop policy if exists "patient_functional_exams_delete" on public.patient_functional_exams;
create policy "patient_functional_exams_delete" on public.patient_functional_exams
  for delete using (public.can_write_clinic_data(clinic_id));

notify pgrst, 'reload schema';
