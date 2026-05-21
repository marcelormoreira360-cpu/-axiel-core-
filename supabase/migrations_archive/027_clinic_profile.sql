alter table public.clinics
  add column if not exists clinic_profile text
    check (clinic_profile in ('integrativa','fisioterapia','saude_mental','nutricao','wellness'))
    default 'integrativa';
