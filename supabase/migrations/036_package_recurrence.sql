-- Recorrência automática de pacotes de sessão
alter table public.patient_packages
  add column if not exists auto_renew boolean not null default false;
