/**
 * Helpers PUROS do agendamento da Clara (F1), sem dependência de servidor
 * (Supabase/Resend), para poderem ser testados isoladamente e importados por
 * componentes client. O serviço services/clara-booking-service.ts os reexporta.
 */

export type SlotPreference = "morning" | "afternoon" | null;

export type OfferedSlot = { iso: string; label: string };

/**
 * Interpreta a escolha do horário pelo paciente (1..count).
 * Aceita dígito ("1", "2", "3"), ordinais PT ("primeiro/segundo/terceiro") e
 * EN ("first/second/third"). Devolve índice 0-based ou -1 se não reconhecer.
 */
export function parseSlotChoice(text: string, count: number): number {
  if (!text || count <= 0) return -1;
  const lower = ` ${text.toLowerCase().trim()} `;

  // Dígito isolado ou no meio ("2", "opção 2", "quero o 2", "2 por favor").
  const digitMatch = lower.match(/\b([1-9])\b/);
  if (digitMatch) {
    const n = Number(digitMatch[1]);
    if (n >= 1 && n <= count) return n - 1;
  }

  const ordinals: Array<[string[], number]> = [
    [["primeiro", "primeira", "first", "1o", "1º", "1a", "1ª"], 0],
    [["segundo", "segunda", "second", "2o", "2º", "2a", "2ª"], 1],
    [["terceiro", "terceira", "third", "3o", "3º", "3a", "3ª"], 2],
  ];
  for (const [words, idx] of ordinals) {
    if (idx < count && words.some((w) => lower.includes(` ${w} `) || lower.includes(`${w} `) || lower.includes(` ${w}`))) {
      return idx;
    }
  }
  return -1;
}

/**
 * Extrai a preferência de período (manhã/tarde) da mensagem do paciente.
 * Reconhece PT (manhã/tarde/cedo) e EN (morning/afternoon). Sem sinal ou
 * ambíguo (cita os dois) → null.
 */
export function parsePeriodPreference(text: string): SlotPreference {
  if (!text) return null;
  const lower = text.toLowerCase();
  const morning = ["manhã", "manha", "cedo", "morning", "am ", " am", "a.m"];
  const afternoon = ["tarde", "afternoon", "pm ", " pm", "p.m"];
  const hasMorning = morning.some((w) => lower.includes(w));
  const hasAfternoon = afternoon.some((w) => lower.includes(w));
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
