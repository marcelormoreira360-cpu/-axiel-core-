-- 145_patients_timezone.sql
-- Fuso horário do paciente (IANA, ex.: "America/Sao_Paulo").
--
-- Motivo: agendamentos entre países (clínica nos EUA, paciente no Brasil) precisam
-- exibir o horário no fuso do PACIENTE, inclusive em e-mail/WhatsApp gerados no
-- servidor (que não têm acesso ao navegador). O valor é capturado do navegador no
-- primeiro acesso a um link de agendamento/confirmação e reusado depois; quando a
-- clínica agenda pelo paciente (voz/telefone), o fuso é inferido de country/phone.
--
-- Nullable e sem default: NULL significa "ainda não capturado" → o código cai na
-- inferência (telefone/país) e, por fim, no fuso da clínica.

ALTER TABLE patients ADD COLUMN IF NOT EXISTS timezone text;

COMMENT ON COLUMN patients.timezone IS
  'Fuso IANA do paciente (ex.: America/Sao_Paulo). Capturado do navegador no 1º acesso ao link; usado para exibir horários no fuso do paciente, inclusive em e-mail/WhatsApp. NULL = inferir de phone/country → fallback fuso da clínica.';
