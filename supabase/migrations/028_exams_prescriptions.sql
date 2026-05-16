-- Exames laboratoriais
create table if not exists public.patient_exams (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  exam_date date not null,
  lab_name text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_exams_patient_id on public.patient_exams(patient_id);

alter table public.patient_exams enable row level security;
create policy "exams_select" on public.patient_exams for select using (public.can_access_clinic(clinic_id));
create policy "exams_insert" on public.patient_exams for insert with check (public.can_write_clinic_data(clinic_id));
create policy "exams_update" on public.patient_exams for update using (public.can_write_clinic_data(clinic_id));
create policy "exams_delete" on public.patient_exams for delete using (public.can_write_clinic_data(clinic_id));

-- Resultados individuais de cada exame (biomarcadores)
create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.patient_exams(id) on delete cascade,
  biomarker text not null,
  value numeric not null,
  unit text,
  ref_min numeric,
  ref_max numeric,
  -- low | normal | high | unknown
  status text generated always as (
    case
      when ref_min is null or ref_max is null then 'unknown'
      when value < ref_min then 'low'
      when value > ref_max then 'high'
      else 'normal'
    end
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists idx_exam_results_exam_id on public.exam_results(exam_id);

alter table public.exam_results enable row level security;
create policy "exam_results_select" on public.exam_results
  for select using (
    exists (
      select 1 from public.patient_exams e
      where e.id = exam_id and public.can_access_clinic(e.clinic_id)
    )
  );
create policy "exam_results_insert" on public.exam_results
  for insert with check (
    exists (
      select 1 from public.patient_exams e
      where e.id = exam_id and public.can_write_clinic_data(e.clinic_id)
    )
  );
create policy "exam_results_delete" on public.exam_results
  for delete using (
    exists (
      select 1 from public.patient_exams e
      where e.id = exam_id and public.can_write_clinic_data(e.clinic_id)
    )
  );

-- Prescrições (medicamentos e suplementos)
create table if not exists public.patient_prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  -- medication | supplement
  type text not null default 'supplement' check (type in ('medication', 'supplement')),
  name text not null,
  dosage text,
  frequency text,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_patient_prescriptions_patient_id on public.patient_prescriptions(patient_id);

alter table public.patient_prescriptions enable row level security;
create policy "prescriptions_select" on public.patient_prescriptions for select using (public.can_access_clinic(clinic_id));
create policy "prescriptions_insert" on public.patient_prescriptions for insert with check (public.can_write_clinic_data(clinic_id));
create policy "prescriptions_update" on public.patient_prescriptions for update using (public.can_write_clinic_data(clinic_id));
create policy "prescriptions_delete" on public.patient_prescriptions for delete using (public.can_write_clinic_data(clinic_id));
