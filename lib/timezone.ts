/**
 * Utilitários de fuso horário para agendamentos.
 *
 * Regra da casa: `starts_at` é SEMPRE um instante em UTC (ISO terminando em Z).
 * Toda exibição ao paciente deve mostrar o horário no fuso do PACIENTE (onde ele
 * está) e, quando diferente, também no da CLÍNICA — nunca no fuso do runtime
 * (navegador/servidor), que é o que gera o clássico deslocamento de 1h.
 *
 * O fuso do paciente é resolvido nesta ordem (ver `resolvePatientTimezone`):
 *   1. `patients.timezone` salvo (capturado do navegador no 1º acesso ao link);
 *   2. inferência pelo DDI do telefone;
 *   3. inferência pelo país (`patients.country`);
 *   4. fallback = fuso da clínica.
 */

// ── Validação ─────────────────────────────────────────────────────────────────

/** true se `tz` é um nome IANA que o runtime reconhece (ex.: "America/Sao_Paulo"). */
export function isValidTimezone(tz?: string | null): tz is string {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ── Inferência por país / telefone ────────────────────────────────────────────
// Aproximado, cobrindo os mercados do negócio (BR, US, PT + alguns vizinhos).
// Países multi-fuso caem num padrão razoável; o valor salvo do navegador sempre
// vence a inferência.

const COUNTRY_TZ: Record<string, string> = {
  BR: "America/Sao_Paulo",
  US: "America/New_York",
  PT: "Europe/Lisbon",
  AR: "America/Argentina/Buenos_Aires",
  UY: "America/Montevideo",
  PY: "America/Asuncion",
  CL: "America/Santiago",
  CO: "America/Bogota",
  MX: "America/Mexico_City",
  CA: "America/Toronto",
  GB: "Europe/London",
  ES: "Europe/Madrid",
};

// DDI (código de discagem internacional) → fuso padrão.
const DDI_TZ: Record<string, string> = {
  "55": "America/Sao_Paulo", // Brasil
  "1": "America/New_York", // EUA/Canadá (padrão costa leste)
  "351": "Europe/Lisbon", // Portugal
  "54": "America/Argentina/Buenos_Aires",
  "598": "America/Montevideo",
  "595": "America/Asuncion",
  "56": "America/Santiago",
  "57": "America/Bogota",
  "52": "America/Mexico_City",
  "44": "Europe/London",
  "34": "Europe/Madrid",
};

/** Deriva o fuso a partir do código de país ISO-3166 alpha-2 (ex.: "BR"). */
export function inferTimezoneFromCountry(country?: string | null): string | null {
  if (!country) return null;
  const key = country.trim().toUpperCase();
  return COUNTRY_TZ[key] ?? null;
}

/**
 * Deriva o fuso a partir do DDI do telefone. Aceita "+55 44 ...", "0055...",
 * "5544..." etc. Casa o DDI mais longo primeiro (ex.: 351 antes de 3/5).
 */
export function inferTimezoneFromPhone(phone?: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  // Prefixo internacional "00" (ex.: 0055...) → remove.
  if (digits.startsWith("00")) digits = digits.slice(2);
  const ddis = Object.keys(DDI_TZ).sort((a, b) => b.length - a.length);
  for (const ddi of ddis) {
    if (digits.startsWith(ddi)) return DDI_TZ[ddi];
  }
  return null;
}

/**
 * Resolve o fuso do paciente. `fallback` deve ser o fuso da clínica.
 * O valor salvo (navegador) tem prioridade absoluta; depois telefone; depois país.
 */
export function resolvePatientTimezone(input: {
  stored?: string | null;
  country?: string | null;
  phone?: string | null;
  fallback: string;
}): string {
  if (isValidTimezone(input.stored)) return input.stored;
  return (
    inferTimezoneFromPhone(input.phone) ??
    inferTimezoneFromCountry(input.country) ??
    input.fallback
  );
}

// ── Rótulos amigáveis ─────────────────────────────────────────────────────────

type LocaleKey = "pt-BR" | "en" | "pt-PT";

const TZ_LABELS: Record<string, Partial<Record<LocaleKey, string>>> = {
  "America/Sao_Paulo": { "pt-BR": "Brasília", "pt-PT": "Brasília", en: "Brasília" },
  "America/New_York": { "pt-BR": "Nova York", "pt-PT": "Nova Iorque", en: "New York" },
  "America/Chicago": { "pt-BR": "Chicago", en: "Chicago" },
  "America/Denver": { "pt-BR": "Denver", en: "Denver" },
  "America/Los_Angeles": { "pt-BR": "Los Angeles", en: "Los Angeles" },
  "America/Toronto": { "pt-BR": "Toronto", en: "Toronto" },
  "Europe/Lisbon": { "pt-BR": "Lisboa", "pt-PT": "Lisboa", en: "Lisbon" },
  "Europe/London": { "pt-BR": "Londres", en: "London" },
  "Europe/Madrid": { "pt-BR": "Madri", "pt-PT": "Madrid", en: "Madrid" },
  "America/Argentina/Buenos_Aires": { "pt-BR": "Buenos Aires", en: "Buenos Aires" },
  "America/Montevideo": { "pt-BR": "Montevidéu", en: "Montevideo" },
  "America/Bogota": { "pt-BR": "Bogotá", en: "Bogotá" },
  "America/Mexico_City": { "pt-BR": "Cidade do México", en: "Mexico City" },
};

function normLocale(locale: string): LocaleKey {
  if (locale.startsWith("pt-PT")) return "pt-PT";
  if (locale.startsWith("pt")) return "pt-BR";
  return "en";
}

/** Rótulo curto e legível do fuso (ex.: "Brasília"). Fallback = cidade do nome IANA. */
export function timezoneLabel(tz: string, locale: string): string {
  const known = TZ_LABELS[tz];
  const lk = normLocale(locale);
  if (known) return known[lk] ?? known.en ?? tz;
  const city = tz.split("/").pop()?.replace(/_/g, " ");
  return city || tz;
}

// ── Formatação (paciente + clínica) ───────────────────────────────────────────

export interface ZoneTime {
  /** Fuso IANA usado. */
  tz: string;
  /** Rótulo amigável (ex.: "Brasília"). */
  label: string;
  /** Data por extenso (ex.: "20 de agosto"). */
  date: string;
  /** Data compacta (ex.: "sex, 20 de ago"). */
  dateShort: string;
  /** Data com dia da semana (ex.: "sexta-feira, 20 de agosto"). */
  dateLong: string;
  /** Hora (ex.: "10:00" ou "9:00 AM" conforme locale). */
  time: string;
}

function formatZoneTime(iso: string, tz: string, locale: string): ZoneTime {
  const d = new Date(iso);
  return {
    tz,
    label: timezoneLabel(tz, locale),
    date: d.toLocaleDateString(locale, { day: "numeric", month: "long", timeZone: tz }),
    dateShort: d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: tz }),
    dateLong: d.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: tz,
    }),
    time: d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: tz }),
  };
}

export interface DualTime {
  patient: ZoneTime;
  clinic: ZoneTime;
  /** true quando paciente e clínica veem exatamente o mesmo horário (mesmo offset). */
  sameZone: boolean;
}

/**
 * Formata um instante UTC nos dois fusos. Quando o horário exibido coincide
 * (mesmo offset no instante), `sameZone` é true e as telas mostram só um horário.
 */
export function formatDualTime(input: {
  iso: string;
  patientTz: string;
  clinicTz: string;
  locale: string;
}): DualTime {
  const patient = formatZoneTime(input.iso, input.patientTz, input.locale);
  const clinic = formatZoneTime(input.iso, input.clinicTz, input.locale);
  const sameZone = patient.date === clinic.date && patient.time === clinic.time;
  return { patient, clinic, sameZone };
}

// Conectores localizados para montar texto puro (WhatsApp, assunto de e-mail).
const CONNECTORS: Record<LocaleKey, { at: string; yourTime: string; clinicTime: string }> = {
  "pt-BR": { at: "às", yourTime: "no seu horário", clinicTime: "na clínica" },
  "pt-PT": { at: "às", yourTime: "no seu horário", clinicTime: "na clínica" },
  en: { at: "at", yourTime: "your time", clinicTime: "clinic time" },
};

/**
 * Duas linhas prontas (data e hora) para e-mail/WhatsApp/telas server-side.
 * `timeStr` já vem no formato duplo quando os fusos diferem. Ex.:
 *   { dateStr: "sexta-feira, 20 de agosto",
 *     timeStr: "10:00 no seu horário (Brasília) · 09:00 na clínica (Nova York)" }
 */
export function dualTimeLines(input: {
  iso: string;
  patientTz: string;
  clinicTz: string;
  locale: string;
}): { dateStr: string; timeStr: string } {
  const { patient, clinic, sameZone } = formatDualTime(input);
  const c = CONNECTORS[normLocale(input.locale)];
  return {
    dateStr: patient.dateLong,
    timeStr: sameZone
      ? `${patient.time} (${patient.label})`
      : `${patient.time} ${c.yourTime} (${patient.label}) · ${clinic.time} ${c.clinicTime} (${clinic.label})`,
  };
}

/**
 * Texto puro pronto para WhatsApp/e-mail. Ex.:
 *   "sexta-feira, 20 de agosto · 10:00 no seu horário (Brasília) · 09:00 na clínica (Nova York)"
 * Quando o fuso coincide: "sexta-feira, 20 de agosto às 10:00 (Brasília)".
 */
export function dualTimeText(input: {
  iso: string;
  patientTz: string;
  clinicTz: string;
  locale: string;
}): string {
  const { patient, clinic, sameZone } = formatDualTime(input);
  const c = CONNECTORS[normLocale(input.locale)];
  if (sameZone) {
    return `${patient.dateLong} ${c.at} ${patient.time} (${patient.label})`;
  }
  const clinicDatePrefix = patient.date === clinic.date ? "" : `${clinic.dateLong} · `;
  return (
    `${patient.dateLong} · ${patient.time} ${c.yourTime} (${patient.label})` +
    ` · ${clinicDatePrefix}${clinic.time} ${c.clinicTime} (${clinic.label})`
  );
}
