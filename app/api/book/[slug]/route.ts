import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWhatsAppText } from "@/services/whatsapp-service";
import { scheduleAutomations } from "@/services/automation-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";

export const runtime = "nodejs";

// GET /api/book/[slug] — public clinic info + session types
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, slug, logo_url, primary_color")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!clinic) return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });

  const [{ data: sessionTypes }, { data: workingHours }, { data: practitionersRaw }, { data: clinicSettings }] = await Promise.all([
    supabase.from("session_types").select("id, name, duration_minutes, price_cents").eq("clinic_id", clinic.id).eq("is_active", true).order("name"),
    supabase.from("working_hours").select("day_of_week, opens_at, closes_at, is_open").eq("clinic_id", clinic.id),
    supabase.from("clinic_users").select("user_id, display_name, specialty, bio, users(full_name)").eq("clinic_id", clinic.id).eq("status", "active").eq("is_bookable", true),
    supabase.from("clinic_settings").select("settings").eq("clinic_id", clinic.id).maybeSingle(),
  ]);

  // L-05: include the clinic's configured currency in the public response
  const currency = (clinicSettings?.settings as Record<string, unknown> | null)?.default_currency as string ?? "BRL";

  const practitioners = (practitionersRaw ?? []).map((p) => {
    const usersData = p.users as unknown as { full_name: string } | null;
    return {
      id: p.user_id,
      display_name: p.display_name ?? usersData?.full_name ?? "Profissional",
      specialty: p.specialty ?? null,
      bio: p.bio ?? null,
    };
  });

  return NextResponse.json({ clinic: { ...clinic, currency }, sessionTypes: sessionTypes ?? [], workingHours: workingHours ?? [], practitioners });
}

// POST /api/book/[slug] — create appointment (public)
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  // ── Rate limiting: 10 bookings per IP per 15-minute window ─────────────────
  // Uses distributed Supabase-backed counter (M-08) so all Vercel instances share state.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimitDb(`book:${ip}`, 10, 15 * 60_000))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429 });
  }

  const { slug } = await params;
  const body = await req.json();
  const { session_type_id, starts_at, full_name, email, phone, notes, practitioner_id } = body;

  if (!session_type_id || !starts_at || !full_name || !phone) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes." }, { status: 400 });
  }

  // ── Field length validation ─────────────────────────────────────────────────
  if (typeof full_name !== "string" || full_name.trim().length > 120) {
    return NextResponse.json({ error: "Nome inválido (máximo 120 caracteres)." }, { status: 400 });
  }
  if (email && (typeof email !== "string" || email.length > 254)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (typeof phone !== "string" || phone.length > 30) {
    return NextResponse.json({ error: "Telefone inválido." }, { status: 400 });
  }
  if (notes && (typeof notes !== "string" || notes.length > 1000)) {
    return NextResponse.json({ error: "Observações muito longas (máximo 1000 caracteres)." }, { status: 400 });
  }

  // ── Date validation: must be in the future, within 1 year ──────────────────
  const startsAtDate = new Date(starts_at);
  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (isNaN(startsAtDate.getTime()) || startsAtDate <= now || startsAtDate > oneYearFromNow) {
    return NextResponse.json({ error: "Data de agendamento inválida." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!clinic) return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });

  const { data: sessionType } = await supabase
    .from("session_types")
    .select("id, name, duration_minutes")
    .eq("id", session_type_id)
    .eq("clinic_id", clinic.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!sessionType) return NextResponse.json({ error: "Tipo de sessão não encontrado." }, { status: 404 });

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
    if (patientError) return NextResponse.json({ error: "Erro ao registrar paciente." }, { status: 500 });
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
      practitioner_id: practitioner_id || null,
    })
    .select("id, clinic_id, patient_id, starts_at")
    .single();

  if (apptError) return NextResponse.json({ error: "Erro ao criar agendamento." }, { status: 500 });

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
