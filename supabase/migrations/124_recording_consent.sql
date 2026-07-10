-- 124_recording_consent.sql — Consentimento de gravação/escriba clínico (PHF/PHI)
-- Gravar/transcrever a consulta por IA captura PHI, então exige consentimento do
-- paciente registrado (trilha de auditoria: quando e por quem). O ÁUDIO em si NÃO
-- é armazenado pelo Core (transitório: transcreve e descarta; só o rascunho de
-- SOAP/ATM, já parte do prontuário consentido, é gravado) — essa é a política de
-- retenção. Idempotente. Aplicar via Supabase → SQL Editor → Run. (RLS de patients
-- já cobre estas colunas; sem policy nova.)

alter table public.patients
  add column if not exists recording_consent_at timestamptz,
  add column if not exists recording_consent_by uuid references public.users(id);

comment on column public.patients.recording_consent_at is
  'Quando o paciente consentiu com gravação/transcrição da consulta por IA (escriba). Null = sem consentimento (escriba bloqueado).';
comment on column public.patients.recording_consent_by is
  'Usuário (staff) que registrou o consentimento de gravação.';
