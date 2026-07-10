-- 128_clinic_session_config.sql
-- Registro de sessão configurável por clínica: vitais relatados pelo paciente e a
-- ESCALA (antes cravados em 4 vitais fixos e escala 1–5 no componente). Guardado
-- em clinics.session_config (jsonb). NULL = usa o default do código (comportamento
-- atual), então nada muda para clínicas existentes.
-- Formato: { "scaleMax": 5, "vitals": [ { "key","label","low","high","color" } ] }

alter table if exists public.clinics
  add column if not exists session_config jsonb;

comment on column public.clinics.session_config is
  'Config do registro de sessão (vitais + escala). NULL = default do código (4 vitais, escala 1-5). Ver modules/session/session-config.ts.';
