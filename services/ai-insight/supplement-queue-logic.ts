import type { AiInsight } from "@/lib/types";

// Lógica PURA da fila de regeneração de suplementação (Fase 2). Sem deps de
// servidor, para ser unit-testável isolada.

/**
 * Versão do raciocínio de suplementação carimbada no insight. A elegibilidade em
 * massa vive no SQL (eligible_supplement_regeneration_patients); esta helper é
 * usada para registrar no job a versão REALMENTE produzida pela regeneração.
 */
export function currentSupplementVersion(insight: AiInsight | null): string | null {
  if (!insight) return null;
  const out = insight.final_output ?? insight.output;
  return out?.supplement_reasoning_version ?? null;
}

/**
 * Estado do job após uma falha: volta para 'pending' (retry) enquanto houver
 * tentativa; vira 'failed' quando esgota max_attempts. `attempts` é a contagem
 * JÁ INCREMENTADA da tentativa que acabou de falhar.
 */
export function resolveJobStatusAfterFailure(attempts: number, maxAttempts: number): "pending" | "failed" {
  return attempts >= maxAttempts ? "failed" : "pending";
}

/**
 * O envio (Fase 4) só conta como feito se PELO MENOS um canal (e-mail ou WhatsApp)
 * realmente enviou. "skipped_no_contact"/"no_report"/"failed" não marcam enviado.
 */
export function isSupplementSent(emailStatus: string, whatsappStatus: string): boolean {
  return emailStatus === "sent" || whatsappStatus === "sent";
}

/**
 * Há trabalho de suplementação esperando pelo gestor (Fase 2b, cron de notificação):
 * pacientes a atualizar, jobs na fila, ou aprovados prontos para enviar.
 */
export function shouldNudgeRegeneration(eligible: number, pending: number, sendable: number): boolean {
  return eligible + pending + sendable > 0;
}
