/**
 * F1 — Clara agenda de verdade no WhatsApp.
 *
 * Serviço clínica-agnóstico (multi-tenant) que dá à Clara a capacidade de:
 *  - descobrir o tipo de sessão da Avaliação Inicial da clínica (is_evaluation);
 *  - oferecer horários REAIS dos próximos dias (getAvailableSlots);
 *  - agendar de verdade o horário escolhido (createPublicBooking, source 'other').
 *
 * Usa o admin client (webhook roda sem sessão). Todo consumo no route é
 * fail-safe: qualquer falha aqui deve cair no comportamento atual (link + lead).
 *
 * HELPERS PUROS (parseSlotChoice / parsePeriodPreference / formatSlotOptions)
 * ficam sem dependência de servidor para poderem ser testados isoladamente.
 */

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";
import { getAvailableSlots, createPublicBooking } from "@/services/appointment-service";
import {
  parseSlotChoice,
  parsePeriodPreference,
  formatSlotOptions,
  type SlotPreference,
  type OfferedSlot,
} from "@/lib/clara-booking-helpers";

// Reexporta os helpers puros (F1) para quem importa pelo serviço.
export { parseSlotChoice, parsePeriodPreference, formatSlotOptions };
export type { SlotPreference, OfferedSlot };

const log = createLogger("clara-booking");

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type EvaluationSessionType = {
  id: string;
  name: string;
  duration_minutes: number;
};

type OfferEvaluationSlotsResult =
  | { ok: true; slug: string; sessionTypeId: string; slots: OfferedSlot[] }
  | { ok: false };

// Quantos dias à frente varremos procurando horários, e o teto de opções.
const LOOKAHEAD_DAYS = 7;
const MAX_SLOTS = 3;

// ─── Formatação de rótulo (fuso da clínica + locale) ─────────────────────────

function localeTag(locale?: string | null): string {
  if (!locale) return "pt-BR";
  if (locale.startsWith("en")) return "en-US";
  if (locale.startsWith("es")) return "es-ES";
  return "pt-BR";
}

// Conector entre a data e a hora conforme o idioma ("às" / "at" / "a las").
function atConnector(locale?: string | null): string {
  const tag = localeTag(locale);
  if (tag === "en-US") return "at";
  if (tag === "es-ES") return "a las";
  return "às";
}

/**
 * Monta "quinta, 12/09 às 10:00" no fuso da clínica e no idioma do paciente.
 * `time` é o horário de parede local (vindo de getAvailableSlots), então não
 * precisa reconverter fuso para a hora; a data/dia-da-semana saem do ISO no tz.
 */
function buildSlotLabel(iso: string, time: string, timezone: string, locale?: string | null): string {
  const tag = localeTag(locale);
  const dt = new Date(iso);
  let weekday = new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: timezone }).format(dt);
  weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const dayMonth = new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", timeZone: timezone }).format(dt);
  return `${weekday}, ${dayMonth} ${atConnector(locale)} ${time}`;
}

function hourFromLocalTime(time: string): number {
  const [h] = time.split(":");
  return Number(h);
}

// Data YYYY-MM-DD deslocada em `offset` dias a partir de hoje (UTC).
// getAvailableSlots interpreta a data como parede no fuso da clínica e filtra os
// slots passados, então começar por "hoje UTC" é seguro mesmo se a clínica
// estiver adiantada em relação ao UTC.
function dateStringOffset(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

// ─── Resolução da clínica / tipo de sessão ───────────────────────────────────

async function fetchClinicSlug(clinicId: string): Promise<string | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from("clinics").select("slug").eq("id", clinicId).maybeSingle();
    return ((data as { slug?: string } | null)?.slug) ?? null;
  } catch (e) {
    log.error("fetchClinicSlug failed", e, { clinic_id: clinicId });
    return null;
  }
}

/**
 * Tipo de sessão da Avaliação Inicial da clínica: is_evaluation=true e is_active.
 * Achado #5 do review: NÃO cai mais no "1º tipo ativo" — sem uma Avaliação
 * marcada, retorna null (o chamador oferece o link em vez de agendar um serviço
 * qualquer rotulado como "Avaliação Inicial"). Se houver mais de uma, pega a mais
 * antiga (comportamento estável).
 */
export async function getEvaluationSessionType(clinicId: string): Promise<EvaluationSessionType | null> {
  try {
    const supabase = createSupabaseAdminClient();

    const { data: evalType } = await supabase
      .from("session_types")
      .select("id, name, duration_minutes")
      .eq("clinic_id", clinicId)
      .eq("is_evaluation", true)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!evalType) return null;
    return {
      id: evalType.id as string,
      name: (evalType.name as string) ?? "Avaliação Inicial",
      duration_minutes: (evalType.duration_minutes as number | null) ?? 60,
    };
  } catch (e) {
    log.error("getEvaluationSessionType failed", e, { clinic_id: clinicId });
    return null;
  }
}

/**
 * Oferece até 3 horários reais da Avaliação Inicial nos próximos ~7 dias,
 * filtrados pela preferência de período. Devolve { ok:false } em qualquer falha
 * ou quando não há horário (o chamador cai no comportamento atual).
 */
export async function offerEvaluationSlots(opts: {
  clinicId: string;
  preference?: SlotPreference;
  locale?: string | null;
}): Promise<OfferEvaluationSlotsResult> {
  const { clinicId } = opts;
  const preference = opts.preference ?? null;
  try {
    const [slug, evalType] = await Promise.all([
      fetchClinicSlug(clinicId),
      getEvaluationSessionType(clinicId),
    ]);
    if (!slug || !evalType) return { ok: false };

    // Achado #8: busca os ~7 dias em PARALELO (cada getAvailableSlots faz ~5-6
    // queries; em série era latência alta e risco de reenvio do webhook Meta).
    // Promise.all preserva a ordem (dia 0, 1, 2...), então a coleta continua
    // pegando os horários mais próximos primeiro.
    const dayResults = await Promise.all(
      Array.from({ length: LOOKAHEAD_DAYS }, (_, offset) =>
        getAvailableSlots({ slug, date: dateStringOffset(offset), sessionTypeId: evalType.id }),
      ),
    );

    const collected: OfferedSlot[] = [];
    for (const res of dayResults) {
      if (collected.length >= MAX_SLOTS) break;
      if (!res.ok || res.slots.length === 0) continue;
      for (const slot of res.slots) {
        if (collected.length >= MAX_SLOTS) break;
        const hour = hourFromLocalTime(slot.time);
        if (preference === "morning" && hour >= 12) continue;
        if (preference === "afternoon" && hour < 12) continue;
        collected.push({
          iso: slot.iso,
          label: buildSlotLabel(slot.iso, slot.time, res.timezone, opts.locale),
        });
      }
    }

    if (collected.length === 0) return { ok: false };
    return { ok: true, slug, sessionTypeId: evalType.id, slots: collected };
  } catch (e) {
    log.error("offerEvaluationSlots failed", e, { clinic_id: clinicId });
    return { ok: false };
  }
}

/**
 * Agenda o horário escolhido via createPublicBooking. `source:'other'` porque o
 * enum de appointments.source não aceita "whatsapp". Repassa o resultado cru
 * (o chamador decide a mensagem de sucesso/falha).
 */
export async function bookEvaluationSlot(opts: {
  clinicId: string;
  slug: string;
  sessionTypeId: string;
  iso: string;
  fullName: string;
  phone: string;
  locale?: string | null;
}): Promise<Awaited<ReturnType<typeof createPublicBooking>>> {
  try {
    // Trava (achado #1 — BLOQUEADOR): nunca agendar um horário que já passou.
    // booking_state.offered pode conter horários velhos (paciente responde dias
    // depois). Slot já ocupado por outro é barrado pelo hasAppointmentConflict
    // dentro de createPublicBooking; o passado, não — por isso o guard aqui.
    if (new Date(opts.iso).getTime() <= Date.now()) {
      return { ok: false, error: "slot_in_past", code: "SLOT_PAST", status: 409 };
    }
    return await createPublicBooking({
      slug: opts.slug,
      session_type_id: opts.sessionTypeId,
      starts_at: opts.iso,
      full_name: opts.fullName,
      phone: opts.phone,
      locale: opts.locale ?? null,
      source: "other",
    });
  } catch (e) {
    log.error("bookEvaluationSlot failed", e, { clinic_id: opts.clinicId });
    return { ok: false, error: "booking_failed", code: "EXCEPTION", status: 500 };
  }
}
