/**
 * lab-status.ts — semáforo de exame laboratorial (puro, client + server).
 *
 * Mesma regra do status derivado no banco (exam_results): compara o valor com a
 * faixa de referência. Usado para a cor AO VIVO enquanto o terapeuta digita/extrai.
 */

export type LabStatus = "low" | "normal" | "high" | "unknown";

export function labStatus(
  value: number | null,
  refMin: number | null,
  refMax: number | null,
): LabStatus {
  if (value === null || !Number.isFinite(value)) return "unknown";
  if (refMin === null && refMax === null) return "unknown";
  if (refMin !== null && value < refMin) return "low";   // amarelo
  if (refMax !== null && value > refMax) return "high";  // vermelho
  return "normal";                                        // verde
}

/** Cores do semáforo: verde (normal) · amarelo (baixo) · vermelho (alto). */
export const LAB_STATUS_COLOR: Record<LabStatus, string> = {
  high: "#ef4444",
  low: "#d97706",
  normal: "#0F6E56",
  unknown: "#D3D1C7",
};
