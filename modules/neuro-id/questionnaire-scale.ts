/**
 * questionnaire-scale.ts — tetos (score máximo) dos itens derivados de questionário.
 *
 * O motor Bio³ trabalha em escala 0–10 (disfunção = valor × 10). Mas o terapeuta
 * lê do papel a nota CRUA do questionário (ex.: Q-SNA total 0–180, cada nível
 * 0–20, QRM total 0–272, por seção). Para não obrigar a conta na mão, o
 * formulário exibe/edita a nota crua e converte para 0–10 na hora de salvar
 * (via campo oculto). Storage, motor e o "Import" continuam em 0–10 e intactos.
 *
 * Tetos vindos dos próprios templates do sistema:
 *  - Q-SNA: 45 perguntas × 4 = 180 total; cada nível 5 × 4 = 20.
 *  - QRM (Rastreamento Metabólico): 68 × 4 = 272 total; por seção conforme abaixo.
 */

export const RAW_MAX_BY_CODE: Record<string, number> = {
  // Q-SNA
  qsna_total: 180,
  qsna_sono: 20,
  qsna_emocional: 20,
  qsna_gi_visceral: 20,
  qsna_neurocognitiva: 20,
  // QRM / Rastreamento Metabólico
  qrm_total: 272,
  qrm_coracao: 12,
  qrm_pulmao: 16,
  qrm_trato_digestivo: 28,
  qrm_mente: 32,
  qrm_emocoes: 16,
  qrm_musculo_articular: 20,
  intestino: 28, // seção "Trato digestivo" do QRM
  // Demais seções do QRM/MSQ (caso a clínica use)
  msq_head: 16,
  msq_eyes: 16,
  msq_ears: 16,
  msq_nose: 20,
  msq_mouth_throat: 20,
  msq_skin: 20,
  msq_energy: 20,
  msq_other: 16,
  // Escalas padrão
  phq9_depressao: 27,
  gad7_ansiedade: 21,
};

export function rawMaxFor(code: string): number | undefined {
  return RAW_MAX_BY_CODE[code];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const toNum = (s: string) => Number(s.replace(",", "."));

/** Nota crua (0..teto) → escala 0–10 do motor (string; preserva a precisão). */
export function rawToNormalized(code: string, rawStr: string): string {
  const max = RAW_MAX_BY_CODE[code];
  if (max === undefined || rawStr.trim() === "") return rawStr;
  const raw = toNum(rawStr);
  if (!Number.isFinite(raw)) return "";
  return String(clamp((raw / max) * 10, 0, 10));
}

/** Escala 0–10 armazenada → nota crua (0..teto) para exibição (arredonda ao inteiro). */
export function normalizedToRaw(code: string, normStr: string): string {
  const max = RAW_MAX_BY_CODE[code];
  if (max === undefined || normStr.trim() === "") return normStr;
  const norm = toNum(normStr);
  if (!Number.isFinite(norm)) return "";
  return String(Math.round(clamp((norm / 10) * max, 0, max)));
}

// ── Sintoma comum: duas perguntas curtas (frequência 0–3 × impacto 0–3) ────────
// Decisão de Marcelo: carga = freq × impacto (0–9). O motor recebe um valor único
// por code; a combinação acontece AQUI (camada de import), NUNCA em `scoring.ts`.
// Regra: freq ausente = null (dado faltando). freq 0 = 0 (não pergunta impacto).
// freq ≥ 1 com impacto ausente = null (incompleto, não zera falsamente). A
// segurança cardiorrespiratória usa a frequência sozinha (ver lib/safety-flags).

const to0to3 = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(3, n));
};

/** Combina frequência (0–3) e impacto (0–3) na carga do sintoma (0–9). null = dado faltando. */
export function combineFreqImp(freq: unknown, imp: unknown): number | null {
  const f = to0to3(freq);
  if (f === null) return null;
  if (f === 0) return 0;
  const i = to0to3(imp);
  if (i === null) return null;
  return f * i; // 0..9
}

/** Carga combinada (0–9) → escala 0–10 do motor. Use RAW_MAX = 9 no code do sintoma. */
export function freqImpToScale10(freq: unknown, imp: unknown): number | null {
  const combined = combineFreqImp(freq, imp);
  return combined === null ? null : clamp((combined / 9) * 10, 0, 10);
}
