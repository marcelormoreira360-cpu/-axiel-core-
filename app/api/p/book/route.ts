import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { scheduleAutomations } from "@/services/automation-service";
import { sendAppointmentConfirmation } from "@/services/email-service";
import { resolveClinicLocale } from "@/lib/email-i18n";
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

  const { token, session_type_id, starts_at } = body as {
    token?: string;
    session_type_id?: string;
    starts_at?: string;
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
    supabase.from("patients").select("full_name, phone, email").eq("id", link.patient_id).maybeSingle(),
    supabase.from("clinics").select("name").eq("id", link.clinic_id).maybeSingle(),
  ]);

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
    return NextResponse.json({ error: "Erro ao criar agendamento." }, { status: 500 });
  }

  // ── WhatsApp confirmation (non-blocking) ──────────────────────────────────────
  if (patient?.phone) {
    try {
      const { getClinicTimezone } = await import("@/services/clinic-service");
      const tz = await getClinicTimezone(link.clinic_id as string);
      const date = new Date(starts_at);
      const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
      const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
      const firstName = (patient.full_name as string).split(" ")[0];
      await sendWhatsAppText(
        patient.phone as string,
        `Olá, ${firstName}! ✅\n\nSeu agendamento foi confirmado:\n📅 ${dateStr}\n🕐 ${timeStr}\n🩺 ${sessionType.name}\n\n${clinic?.name ?? ""}`,
      );
    } catch {
      /* non-blocking */
    }
  }

  // ── Email confirmation (non-blocking) ────────────────────────────────────────
  if (patient?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
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
      portalUrl: portalLink ? `${appUrl}/p/${token}` : undefined,
      locale: await resolveClinicLocale(link.clinic_id),
    });
  }

  // ── Schedule automations ──────────────────────────────────────────────────────
  scheduleAutomations(appointment).catch(() => {});

  return NextResponse.json({ ok: true, appointment_id: appointment.id });
}
