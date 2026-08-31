import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { scheduleAutomations } from "@/services/automation-service";
import { sendAppointmentConfirmation } from "@/services/email-service";
import { resolvePatientLocale } from "@/lib/email-i18n";
import crypto from "node:crypto";

export const runtime = "nodejs";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// POST /api/p/book — patient self-booking from the portal (token-authenticated)
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const { token, session_type_id, starts_at, patient_timezone } = body as {
    token?: string;
    session_type_id?: string;
    starts_at?: string;
    patient_timezone?: string;
  };

  if (!token || !session_type_id || !starts_at) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  // Date validation: must be in the future, within 1 year
  const startsAtDate = new Date(starts_at);
  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (isNaN(startsAtDate.getTime()) || startsAtDate <= now || startsAtDate > oneYearFromNow) {
    return NextResponse.json({ error: "Data de agendamento inválida." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const tokenHash = hashToken(token);

  // ── Validate portal link ──────────────────────────────────────────────────────
  const { data: link } = await supabase
    .from("patient_portal_links")
    .select("id, clinic_id, patient_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 401 });
  }

  // ── Validate session type belongs to this clinic ──────────────────────────────
  const { data: sessionType } = await supabase
    .from("session_types")
    .select("id, name, duration_minutes")
    .eq("id", session_type_id)
    .eq("clinic_id", link.clinic_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!sessionType) {
    return NextResponse.json({ error: "Tipo de sessão não encontrado." }, { status: 404 });
  }

  // ── Fetch patient and clinic info for the WhatsApp confirmation ───────────────
  const [{ data: patient }, { data: clinic }] = await Promise.all([
    supabase.from("patients").select("full_name, phone, email, locale, timezone, country").eq("id", link.patient_id).maybeSingle(),
    supabase.from("clinics").select("name").eq("id", link.clinic_id).maybeSingle(),
  ]);

  // Captura do fuso do paciente (navegador válido ou inferido do telefone), só se vazio.
  if (patient && !patient.timezone) {
    const { isValidTimezone, inferTimezoneFromPhone } = await import("@/lib/timezone");
    const capturedTz = isValidTimezone(patient_timezone)
      ? patient_timezone
      : inferTimezoneFromPhone(patient.phone as string | null);
    if (capturedTz) {
      await supabase.from("patients").update({ timezone: capturedTz }).eq("id", link.patient_id);
    }
  }

  // Slot pode ter sido tomado entre o carregamento e o submit
  const { hasAppointmentConflict } = await import("@/services/appointment-service");
  if (await hasAppointmentConflict({
    clinic_id: link.clinic_id as string,
    starts_at,
    duration_minutes: sessionType.duration_minutes,
  })) {
    return NextResponse.json(
      { error: "Este horário acabou de ser reservado. Escolha outro.", code: "SLOT_TAKEN" },
      { status: 409 },
    );
  }

  // ── Create appointment ────────────────────────────────────────────────────────
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      clinic_id: link.clinic_id,
      patient_id: link.patient_id,
      session_type_id,
      starts_at,
      duration_minutes: sessionType.duration_minutes,
      source: "portal",
    })
    .select("id, clinic_id, patient_id, starts_at")
    .single();

  if (apptError) {
    // 23505 = trava anti-duplicata (migration 148): duplo-submit do portal.
    // Devolve o agendamento existente e pula a notificação (idempotente).
    if ((apptError as { code?: string }).code === "23505") {
      const { data: dup } = await supabase
        .from("appointments")
        .select("id")
        .eq("clinic_id", link.clinic_id)
        .eq("patient_id", link.patient_id)
        .eq("starts_at", starts_at)
        .is("deleted_at", null)
        .not("status", "in", '("cancelled","cancelled_notice","late_cancel","no_show")')
        .limit(1)
        .maybeSingle();
      if (dup) return NextResponse.json({ ok: true, appointment_id: dup.id });
    }
    return NextResponse.json({ error: "Erro ao criar agendamento." }, { status: 500 });
  }

  // ── WhatsApp confirmation (non-blocking) ──────────────────────────────────────
  if (patient?.phone) {
    try {
      const { getClinicTimezone } = await import("@/services/clinic-service");
      const { resolvePatientTimezone, dualTimeLines } = await import("@/lib/timezone");
      const tz = await getClinicTimezone(link.clinic_id as string);
      const patientTz = resolvePatientTimezone({
        stored: patient.timezone as string | null,
        country: patient.country as string | null,
        phone: patient.phone as string | null,
        fallback: tz,
      });
      // Mensagem no idioma do paciente (patients.locale); default pt
      const isEn = typeof patient.locale === "string" && patient.locale.startsWith("en");
      const dateLocale = isEn ? "en-US" : "pt-BR";
      // Exibição dupla: horário no fuso do paciente + clínica (colapsa se igual).
      const { dateStr, timeStr } = dualTimeLines({ iso: starts_at, patientTz, clinicTz: tz, locale: dateLocale });
      const firstName = (patient.full_name as string).split(" ")[0];
      const message = isEn
        ? `Hi, ${firstName}! ✅\n\nYour appointment has been confirmed:\n📅 ${dateStr}\n🕐 ${timeStr}\n🩺 ${sessionType.name}\n\n${clinic?.name ?? ""}`
        : `Olá, ${firstName}! ✅\n\nSeu agendamento foi confirmado:\n📅 ${dateStr}\n🕐 ${timeStr}\n🩺 ${sessionType.name}\n\n${clinic?.name ?? ""}`;
      await sendWhatsAppText(patient.phone as string, message);
    } catch {
      /* non-blocking */
    }
  }

  // ── Email confirmation (non-blocking) ────────────────────────────────────────
  if (patient?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const { getClinicTimezone } = await import("@/services/clinic-service");
    const { resolvePatientTimezone } = await import("@/lib/timezone");
    const tz = await getClinicTimezone(link.clinic_id as string);
    const patientTz = resolvePatientTimezone({
      stored: patient.timezone as string | null,
      country: patient.country as string | null,
      phone: patient.phone as string | null,
      fallback: tz,
    });
    const portalLink = await supabase
      .from("patient_portal_links")
      .select("id")
      .eq("id", link.id)
      .maybeSingle();
    void sendAppointmentConfirmation({
      to: patient.email as string,
      patientFirstName: (patient.full_name as string).split(" ")[0],
      clinicName: clinic?.name as string ?? "Sua clínica",
      sessionTypeName: sessionType.name,
      startsAt: starts_at,
      timezone: tz,
      patientTimezone: patientTz,
      portalUrl: portalLink ? `${appUrl}/p/${token}` : undefined,
      locale: await resolvePatientLocale(patient?.locale as string | null, link.clinic_id),
    });
  }

  // ── Schedule automations ──────────────────────────────────────────────────────
  scheduleAutomations(appointment).catch(() => {});

  return NextResponse.json({ ok: true, appointment_id: appointment.id });
}
