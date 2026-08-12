-- 140_patients_allow_shared_email.sql
-- Permite o MESMO e-mail (e telefone) para pacientes diferentes na mesma clínica.
-- Motivo: crianças/dependentes frequentemente usam o e-mail e o telefone dos pais.
--
-- Remove a trava UNIQUE(clinic_id, lower(email)) que bloqueava o cadastro.
-- O telefone já não possui índice único, então nenhuma mudança é necessária lá.
-- A de-duplicação usada no agendamento (findOrCreatePatientForBooking) continua
-- funcionando por BUSCA (limit 1), sem depender da constraint.

DROP INDEX IF EXISTS patients_clinic_email_unique;
