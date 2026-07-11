// Config do registro de sessão por clínica (vitais relatados + escala).
// Guardada em clinics.session_config (jsonb). O DEFAULT abaixo reproduz o
// comportamento anterior (4 vitais fixos, escala 1–5): clínicas sem config
// customizada continuam idênticas. Uma clínica pode trocar a escala e definir
// os próprios vitais (nome/rótulos livres) pela tela de Definições → Sessão.

export type VitalConfig = {
  key: string;    // id estável: usado em vitals_<key> e no JSONB session_records.vitals
  label: string;  // rótulo livre; vazio = usa o i18n do vital padrão (dor/energia/humor/sono)
  low: string;    // rótulo da ponta baixa (livre; vazio = i18n p/ vital padrão)
  high: string;   // rótulo da ponta alta
  color: string;  // cor hex #RRGGBB
};

export type SessionConfig = {
  scaleMax: number;      // topo da escala (2–10); a base é sempre 1
  vitals: VitalConfig[];
};

// Chaves dos vitais padrão — para estas, rótulo vazio cai no i18n (trilíngue).
export const DEFAULT_VITAL_KEYS = ["dor", "energia", "humor", "sono"] as const;

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  scaleMax: 5,
  vitals: [
    { key: "dor",     label: "", low: "", high: "", color: "#E05252" },
    { key: "energia", label: "", low: "", high: "", color: "#0F6E56" },
    { key: "humor",   label: "", low: "", high: "", color: "#7B5EA7" },
    { key: "sono",    label: "", low: "", high: "", color: "#2A7BC1" },
  ],
};

/** Cópia nova do default (evita compartilhar/mutar o singleton entre requisições). */
export function defaultSessionConfig(): SessionConfig {
  return {
    scaleMax: DEFAULT_SESSION_CONFIG.scaleMax,
    vitals: DEFAULT_SESSION_CONFIG.vitals.map((v) => ({ ...v })),
  };
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Gera um id estável a partir de um texto (sem acento, minúsculo, _). */
export function slugifyVital(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Valida/normaliza a config vinda do banco ou de um form; nunca lança. */
export function coerceSessionConfig(raw: unknown): SessionConfig {
  if (!raw || typeof raw !== "object") return defaultSessionConfig();
  const obj = raw as Record<string, unknown>;

  const scaleRaw = Number(obj.scaleMax);
  const scaleMax = Number.isInteger(scaleRaw) && scaleRaw >= 2 && scaleRaw <= 10 ? scaleRaw : 5;

  const vitalsRaw = Array.isArray(obj.vitals) ? obj.vitals : [];
  const seen = new Set<string>();
  const vitals: VitalConfig[] = [];
  for (const v of vitalsRaw) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    const key = typeof o.key === "string" && o.key.trim() ? slugifyVital(o.key) : slugifyVital(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    vitals.push({
      key,
      label,
      low:  typeof o.low === "string" ? o.low.trim() : "",
      high: typeof o.high === "string" ? o.high.trim() : "",
      color: typeof o.color === "string" && HEX_RE.test(o.color) ? o.color : "#6B6A66",
    });
  }

  if (vitals.length === 0) return { scaleMax, vitals: defaultSessionConfig().vitals };
  return { scaleMax, vitals: vitals.slice(0, 12) };
}
