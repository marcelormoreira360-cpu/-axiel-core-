import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { scheduleAutomations } from "@/services/automation-service";

export const runtime = "nodejs";

// GET /api/book/[slug] — public clinic info + session types
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!clinic) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

  const [{ data: sessionTypes }, { data: workingHours }] = await Promise.all([
    supabase.from("session_types").select("id, name, duration_minutes, price_cents").eq("clinic_id", clinic.id).eq("is_active", true).order("name"),
    supabase.from("working_hours").select("day_of_week, opens_at, closes_at, is_open").eq("clinic_id", clinic.id),
  ]);

  return NextResponse.json({ clinic, sessionTypes: sessionTypes ?? [], workingHours: workingHours ?? [] });
}

// POST /api/book/[slug] — create appointment (public)
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json();
  const { session_type_id, starts_at, full_name, email, phone, notes } = body;

  if (!session_type_id || !starts_at || !full_name || !phone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!clinic) return NextResponse.json({ error: "Clinic not found" }, { status: 404 });

  const { data: sessionType } = await supabase
    .from("session_types")
    .select("id, name, duration_minutes")
    .eq("id", session_type_id)
    .eq("clinic_id", clinic.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!sessionType) return NextResponse.json({ error: "Session type not found" }, { status: 404 });

  // Find or create patient
  const normalizedPhone = phone.replace(/\s/g, "");
  let patientId: string;

  const { data: existing } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinic.id)
    .or(email ? `phone.eq.${normalizedPhone},email.eq.${email}` : `phone.eq.${normalizedPhone}`)
    .maybeSingle();

  if (existing) {
    patientId = existing.id;
  } else {
    const { data: newPatient, error: patientError } = await supabase
      .from("patients")
      .insert({ clinic_id: clinic.id, full_name, email: email || null, phone: normalizedPhone, status: "active" })
      .select("id")
      .single();
    if (patientError) return NextResponse.json({ error: "Failed to create patient" }, { status: 500 });
    patientId = newPatient.id;
  }

  // Create appointment
  const { data: appointment, error: apptError } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinic.id,
      patient_id: patientId,
      session_type_id,
      starts_at,
      duration_minutes: sessionType.duration_minutes,
      source: "website",
      notes: notes || null,
    })
    .select("id, clinic_id, patient_id, starts_at")
    .single();

  if (apptError) return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });

  // WhatsApp confirmation
  try {
    const date = new Date(starts_at);
    const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const firstName = full_name.split(" ")[0];
    await sendWhatsAppText(normalizedPhone,
      `Olá, ${firstName}! ✅\n\nSeu agendamento foi confirmado:\n📅 ${dateStr}\n🕐 ${timeStr}\n🩺 ${sessionType.name}\n\n${clinic.name}`
    );
  } catch { /* non-blocking */ }

  // Schedule automations
  scheduleAutomations(appointment).catch(() => {});

  return NextResponse.json({ ok: true, appointment_id: appointment.id });
}
