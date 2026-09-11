/**
 * Helpers PUROS do agendamento da Clara (F1), sem dependência de servidor
 * (Supabase/Resend), para poderem ser testados isoladamente e importados por
 * componentes client. O serviço services/clara-booking-service.ts os reexporta.
 */

export type SlotPreference = "morning" | "afternoon" | null;

export type OfferedSlot = { iso: string; label: string };

// Palavras de período. Lookbehind evita casar DENTRO de outra palavra — sem ele,
// "amanhã" casaria "manhã" e o filtro de período sairia errado (achado #7 do review).
const PERIOD_RE = /(?<![a-zà-ÿ])(manh[ãa]|tarde|noite|morning|afternoon|evening)/;

/**
 * Interpreta a escolha do horário pelo paciente (1..count).
 * Aceita dígito ("1", "2", "3"), ordinais PT ("primeiro/segundo/terceiro") e
 * EN ("first/second/third"). Devolve índice 0-based ou -1 se não reconhecer.
 *
 * TRAVA (achado #2 do review): NÃO trata um dígito como escolha quando a mensagem
 * carrega contexto de HORA/período/quantidade ("quero as 2 da tarde", "às 3?") —
 * senão agendaria a opção errada em silêncio. Nesses casos devolve -1 (pede de novo).
 */
export function parseSlotChoice(text: string, count: number): number {
  if (!text || count <= 0) return -1;
  const lower = text.toLowerCase().trim();
  const padded = ` ${lower} `;

  // Ordinais explícitos (não ambíguos) — checa primeiro.
  const ordinals: Array<[string[], number]> = [
    [["primeiro", "primeira", "first", "1o", "1º", "1a", "1ª"], 0],
    [["segundo", "segunda", "second", "2o", "2º", "2a", "2ª"], 1],
    [["terceiro", "terceira", "third", "3o", "3º", "3a", "3ª"], 2],
  ];
  for (const [words, idx] of ordinals) {
    if (idx < count && words.some((w) => padded.includes(` ${w} `) || padded.includes(` ${w}`) || padded.includes(`${w} `))) {
      return idx;
    }
  }

  // Contexto de hora/período/quantidade → dígito é hora, não número de opção.
  const hasTimeContext =
    /\d\s*[:h]\s*\d/.test(lower) ||                              // 14:00, 3h30
    /(?<![a-zà-ÿ])[àa]s?\s+\d/.test(lower) ||                    // às 3, as 10
    PERIOD_RE.test(lower) ||
    /(?<![a-zà-ÿ])(hora|horas|hour|hours|am|pm)(?![a-zà-ÿ])/.test(lower);

  // Remove cortesia/estrutura; se sobrar só um dígito, é a escolha.
  const cleaned = lower
    .replace(/[.,!?;:]/g, " ")
    .replace(/(?<![a-zà-ÿ])(op[cç][aã]o|option|quero|gostaria|o|a|os|as|the|please|favor|por|pode|ser|number|n[uú]mero|esse|essa|este|esta|marca|marcar|agenda|agendar)(?![a-zà-ÿ])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/^[1-9]$/.test(cleaned)) {
    const n = Number(cleaned);
    if (n >= 1 && n <= count) return n - 1;
  }

  // Dígito isolado só quando NÃO há contexto de hora/período.
  if (!hasTimeContext) {
    const m = lower.match(/\b([1-9])\b/);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= count) return n - 1;
    }
  }
  return -1;
}

/**
 * Extrai a preferência de período (manhã/tarde) da mensagem do paciente.
 * Reconhece PT (manhã/tarde/cedo) e EN (morning/afternoon). Sem sinal ou
 * ambíguo (cita os dois) → null. Usa lookbehind para não casar dentro de palavra
 * (ex.: "amanhã" NÃO vira manhã).
 */
export function parsePeriodPreference(text: string): SlotPreference {
  if (!text) return null;
  const lower = text.toLowerCase();
  const hasMorning = /(?<![a-zà-ÿ])(manh[ãa]|cedo|morning)/.test(lower) || /\b\d{1,2}\s*am\b/.test(lower);
  const hasAfternoon = /(?<![a-zà-ÿ])(tarde|afternoon)/.test(lower) || /\b\d{1,2}\s*pm\b/.test(lower);
  if (hasMorning && !hasAfternoon) return "morning";
  if (hasAfternoon && !hasMorning) return "afternoon";
  return null;
}

/**
 * Lista numerada dos horários oferecidos, pronta para a mensagem ao paciente.
 * Ex.: "1) quinta, 12/09 às 10:00\n2) sexta, 13/09 às 14:00".
 */
export function formatSlotOptions(slots: OfferedSlot[], _locale?: string): string {
  return slots.map((s, i) => `${i + 1}) ${s.label}`).join("\n");
}
