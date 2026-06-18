-- 090_patient_referral.sql
-- Indicação paciente→paciente (quick win #4). Quem indicou este paciente.
alter table public.patients
  add column if not exists referred_by_patient_id uuid references public.patients(id) on delete set null;

create index if not exists patients_referred_by_idx
  on public.patients (referred_by_patient_id);

comment on column public.patients.referred_by_patient_id is
  'Paciente (da mesma clinica) que indicou este. Canal de indicacao organica.';
