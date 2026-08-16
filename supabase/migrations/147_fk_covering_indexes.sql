-- 147_fk_covering_indexes.sql
-- Índices de cobertura para foreign keys que estavam sem índice (Supabase performance
-- advisor: unindexed_foreign_keys). Melhora joins e, principalmente, os DELETEs em
-- cascata a partir das tabelas-pai (ex.: apagar um agendamento varre os eventos filhos).
-- Todas as tabelas são de features recentes (decisões de taxa, ciclo/status do
-- agendamento, mídia de saída, consentimento de gravação). Additivo e idempotente.

CREATE INDEX IF NOT EXISTS appointment_fee_decisions_decided_by_user_idx
  ON public.appointment_fee_decisions(decided_by_user);
CREATE INDEX IF NOT EXISTS appointment_fee_decisions_patient_id_idx
  ON public.appointment_fee_decisions(patient_id);
CREATE INDEX IF NOT EXISTS appointment_fee_decisions_patient_payment_id_idx
  ON public.appointment_fee_decisions(patient_payment_id);

CREATE INDEX IF NOT EXISTS appointment_lifecycle_events_appointment_id_idx
  ON public.appointment_lifecycle_events(appointment_id);
CREATE INDEX IF NOT EXISTS appointment_lifecycle_events_patient_id_idx
  ON public.appointment_lifecycle_events(patient_id);

CREATE INDEX IF NOT EXISTS appointment_status_events_changed_by_user_idx
  ON public.appointment_status_events(changed_by_user);

CREATE INDEX IF NOT EXISTS outbound_media_jobs_created_by_idx
  ON public.outbound_media_jobs(created_by);

CREATE INDEX IF NOT EXISTS patients_recording_consent_by_idx
  ON public.patients(recording_consent_by);
