-- 148 — Trava anti-duplicata de agendamento (slot por paciente) + limpeza dos duplicados existentes.
--
-- Contexto (incidente 2026-08-21, família Celestino): NÃO havia constraint de banco.
-- Dois submits simultâneos, ou um booking público colidindo com um agendamento interno,
-- criavam 2+ appointments ATIVOS no MESMO (clinic_id, patient_id, starts_at). O único gate
-- era hasAppointmentConflict (read-then-write, sem lock) — sujeito a corrida.
--
-- Este é o único jeito de matar a corrida de verdade: uma trava no próprio banco.
-- O código (createAppointment / createPublicBooking / portal / link de confirmação) foi
-- ajustado para tratar a violação 23505 como idempotência (devolve o agendamento existente).

-- ── 1) Limpa duplicados ATIVOS já existentes ────────────────────────────────────────
-- Por grupo (clinic_id, patient_id, starts_at), mantém UM registro e soft-deleta o resto.
-- Ordem de prioridade para decidir quem FICA (rank 1):
--   1º  quem tem sessão clínica anexada (session_records) — nunca orfanar dado clínico;
--   2º  status mais avançado (completed > checked_in > confirmed > scheduled > pending);
--   3º  o mais antigo (created_at) como desempate estável.
-- Soft-delete (deleted_at) é reversível e auditável; não apaga nada de fato.
--
-- (finding #4) A checagem de session_records vem ANTES de created_at de propósito:
-- garante que uma re-execução desta limpeza nunca soft-delete a duplicata que
-- carrega a nota clínica (esconderia SOAP). session_records.appointment_id é
-- NOT NULL e unique (migration 001), então o EXISTS por appointment é confiável
-- e há no máximo 1 session_record por agendamento — isto torna re-execuções
-- seguras. Migration já aplicada em prod; aqui só reforçamos a documentação.
WITH ranked AS (
  SELECT
    a.id,
    row_number() OVER (
      PARTITION BY a.clinic_id, a.patient_id, a.starts_at
      ORDER BY
        CASE WHEN EXISTS (
          SELECT 1 FROM session_records sr WHERE sr.appointment_id = a.id
        ) THEN 0 ELSE 1 END,
        CASE a.status
          WHEN 'completed'  THEN 0
          WHEN 'checked_in' THEN 1
          WHEN 'confirmed'  THEN 2
          WHEN 'scheduled'  THEN 3
          WHEN 'pending'    THEN 4
          ELSE 5
        END,
        a.created_at
    ) AS rn
  FROM appointments a
  WHERE a.deleted_at IS NULL
    AND a.status NOT IN ('cancelled', 'cancelled_notice', 'late_cancel', 'no_show')
)
UPDATE appointments a
SET deleted_at = now(),
    notes = coalesce(a.notes || E'\n', '') || '[auto] duplicata de slot arquivada (migration 148)'
FROM ranked r
WHERE a.id = r.id
  AND r.rn > 1;

-- ── 2) Índice unique parcial: impede novos duplicados ───────────────────────────────
-- Escopo "ativo" = mesmo conjunto de status que hasAppointmentConflict considera vivo.
-- Cancelado/no-show/soft-deleted ficam FORA do índice: o paciente pode reagendar o mesmo
-- horário depois de um cancelamento sem esbarrar na trava.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_no_dup_patient_slot
  ON appointments (clinic_id, patient_id, starts_at)
  WHERE deleted_at IS NULL
    AND status NOT IN ('cancelled', 'cancelled_notice', 'late_cancel', 'no_show');
