// ─── Serviço: resolução VISUAL da agenda (cores/selos) ─────────────────────────
//
// Resolve, EM LOTE (sem N+1), para uma lista de agendamentos:
//   { categoryColor, categoryIcon, status, paymentBadge|null, isOnline }
// Fonte: session_types (+ categoria) e patient_payments. Multi-tenant: tudo
// escopado por clinic_id; nada hardcoded de clínica. Fail-safe: tipo sem categoria
// cai em cinza; sem pagamento devido/ coberto por pacote -> sem selo.

import type { Appointment } from "@/lib/types";
import { createLogger } from "@/lib/logger";
import {
  computePaymentBadge,
  resolveCategoryColor,
  pickPackageBadge,
  type AppointmentVisual,
  type PaymentLike,
  type PackageLike,
} from "@/modules/schedule/appointment-visuals";

const log = createLogger("appointment-visual-service");

export type SessionTypeCategory = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
};

/** Categorias de tipo de sessão da clínica (para a legenda da agenda). */
export async function getSessionTypeCategories(
  clinicId: string,
): Promise<SessionTypeCategory[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("session_type_categories")
    .select("id, name, color, icon, sort_order")
    .eq("clinic_id", clinicId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    log.error("Falha ao carregar categorias de tipo de sessão", error);
    return [];
  }
  return (data ?? []) as SessionTypeCategory[];
}

/** Só os campos do agendamento que a resolução visual consome. */
type AppointmentForVisual = Pick<
  Appointment,
  | "id"
  | "patient_id"
  | "session_type_id"
  | "patient_offer_id"
  | "source"
  | "status"
  | "video_url"
  | "zoom_join_url"
>;

/**
 * Resolve os dados visuais de uma lista de agendamentos.
 * Retorna um `Record<appointmentId, AppointmentVisual>` (serializável) para o
 * server component anexar em cada agendamento e passar aos client components.
 *
 * 3 queries no total (independe do nº de agendamentos):
 *   1) tipos de sessão da clínica + categoria (cor/ícone) + preço + online
 *   2) pagamentos das sessões desta lista
 * (categorias da legenda são buscadas à parte por getSessionTypeCategories.)
 */
export async function resolveAppointmentVisuals(
  clinicId: string,
  appointments: AppointmentForVisual[],
): Promise<Record<string, AppointmentVisual>> {
  const out: Record<string, AppointmentVisual> = {};
  if (!clinicId || appointments.length === 0) return out;

  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();

  // 1) Tipos de sessão da clínica com a categoria embutida (cor/ícone) + preço + online.
  type StRow = {
    id: string;
    price_cents: number | null;
    is_online: boolean | null;
    color_override: string | null;
    category_id: string | null;
    session_type_categories:
      | { color: string | null; icon: string | null }
      | { color: string | null; icon: string | null }[]
      | null;
  };
  const { data: stData, error: stErr } = await supabase
    .from("session_types")
    .select(
      "id, price_cents, is_online, color_override, category_id, session_type_categories(color, icon)",
    )
    .eq("clinic_id", clinicId);
  if (stErr) log.error("Falha ao carregar tipos de sessão (visual)", stErr);

  const stMap = new Map<
    string,
    { priceCents: number; isOnline: boolean; colorOverride: string | null; categoryColor: string | null; categoryIcon: string | null }
  >();
  for (const row of (stData ?? []) as StRow[]) {
    const cat = Array.isArray(row.session_type_categories)
      ? row.session_type_categories[0]
      : row.session_type_categories;
    stMap.set(row.id, {
      priceCents: row.price_cents ?? 0,
      isOnline: row.is_online ?? false,
      colorOverride: row.color_override ?? null,
      categoryColor: cat?.color ?? null,
      categoryIcon: cat?.icon ?? null,
    });
  }

  // 2) Pagamentos das sessões desta lista (batch), agrupados por appointment_id.
  const apptIds = appointments.map((a) => a.id);
  const paymentsByAppt = new Map<string, PaymentLike[]>();
  // patient_offer_id no pagamento também indica cobertura por pacote.
  const offerCoveredByPayment = new Set<string>();
  {
    // Divide em lotes para não estourar o limite do filtro `in`.
    const CHUNK = 300;
    for (let i = 0; i < apptIds.length; i += CHUNK) {
      const chunk = apptIds.slice(i, i + CHUNK);
      const { data: payData, error: payErr } = await supabase
        .from("patient_payments")
        .select("appointment_id, status, amount_cents, refund_amount_cents, patient_offer_id")
        .eq("clinic_id", clinicId)
        .in("appointment_id", chunk);
      if (payErr) {
        log.error("Falha ao carregar pagamentos (visual)", payErr);
        continue;
      }
      for (const p of (payData ?? []) as Array<{
        appointment_id: string | null;
        status: string | null;
        amount_cents: number | null;
        refund_amount_cents: number | null;
        patient_offer_id: string | null;
      }>) {
        if (!p.appointment_id) continue;
        if (p.patient_offer_id) offerCoveredByPayment.add(p.appointment_id);
        const list = paymentsByAppt.get(p.appointment_id) ?? [];
        list.push({
          status: p.status,
          amount_cents: p.amount_cents,
          refund_amount_cents: p.refund_amount_cents,
        });
        paymentsByAppt.set(p.appointment_id, list);
      }
    }
  }

  // 2b) Pacotes ativos dos pacientes com sessão coberta (batch) → selo "X/Y · Renovar".
  const isCovered = (a: (typeof appointments)[number]) =>
    !!a.patient_offer_id || a.source === "package" || offerCoveredByPayment.has(a.id);
  const coveredPatientIds = [...new Set(appointments.filter(isCovered).map((a) => a.patient_id))];
  const packagesByPatient = new Map<string, PackageLike[]>();
  if (coveredPatientIds.length > 0) {
    const CHUNK = 300;
    for (let i = 0; i < coveredPatientIds.length; i += CHUNK) {
      const chunk = coveredPatientIds.slice(i, i + CHUNK);
      const { data: pkgData, error: pkgErr } = await supabase
        .from("patient_packages")
        .select("patient_id, sessions_used, sessions_total, start_date")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .in("patient_id", chunk);
      if (pkgErr) {
        log.error("Falha ao carregar pacotes (visual)", pkgErr);
        continue;
      }
      for (const p of (pkgData ?? []) as Array<{ patient_id: string; sessions_used: number | null; sessions_total: number; start_date: string }>) {
        const list = packagesByPatient.get(p.patient_id) ?? [];
        list.push({ sessions_used: p.sessions_used, sessions_total: p.sessions_total, start_date: p.start_date });
        packagesByPatient.set(p.patient_id, list);
      }
    }
  }

  // 3) Monta o visual de cada agendamento.
  for (const appt of appointments) {
    const st = appt.session_type_id ? stMap.get(appt.session_type_id) : undefined;

    const categoryColor = resolveCategoryColor(st?.colorOverride, st?.categoryColor);
    const categoryIcon = st?.categoryIcon ?? null;
    const dueCents = st?.priceCents ?? 0;
    const isOnline =
      (st?.isOnline ?? false) || !!appt.zoom_join_url || !!appt.video_url;

    // Coberto por pacote (conservador): FK direta, origem "package" ou pagamento
    // do pacote ligado a esta sessão -> esconde o selo de pagamento.
    const coveredByPackage =
      !!appt.patient_offer_id ||
      appt.source === "package" ||
      offerCoveredByPayment.has(appt.id);

    const paymentBadge = computePaymentBadge({
      dueCents,
      coveredByPackage,
      payments: paymentsByAppt.get(appt.id) ?? [],
    });

    const packageBadge = coveredByPackage
      ? pickPackageBadge(packagesByPatient.get(appt.patient_id) ?? [])
      : null;

    out[appt.id] = {
      categoryColor,
      categoryIcon,
      status: appt.status ?? "scheduled",
      paymentBadge,
      packageBadge,
      isOnline,
    };
  }

  return out;
}
