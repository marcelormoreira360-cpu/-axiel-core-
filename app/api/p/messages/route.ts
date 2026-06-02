import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendPushToClinic } from "@/services/push-service";
import { sendClinicMessageAlert } from "@/services/email-service";
import { resolveClinicLocale } from "@/lib/email-i18n";
import crypto from "node:crypto";

export const runtime = "nodejs";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ── Validate token → returns link or null ────────────────────────────────────
async function validatePortalToken(token: string) {
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashToken(token);

  const { data: link } = await supabase
    .from("patient_portal_links")
    .select("id, clinic_id, patient_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) return null;
  return link as { id: string; clinic_id: string; patient_id: string };
}

// ── GET /api/p/messages?token=... ────────────────────────────────────────────
// Fetches the full conversation for this patient/clinic pair.
// Also marks all clinic→patient messages as read.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 400 });

  const link = await validatePortalToken(token);
  if (!link) return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  // Fetch full conversation
  const { data: messages, error } = await supabase
    .from("portal_messages")
    .select("id, direction, body, read_at, created_at")
    .eq("clinic_id", link.clinic_id)
    .eq("patient_id", link.patient_id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Erro ao buscar mensagens." }, { status: 500 });

  // Mark all unread clinic→patient messages as read
  const unreadClinicIds = (messages ?? [])
    .filter((m) => m.direction === "clinic_to_patient" && !m.read_at)
    .map((m) => m.id);

  if (unreadClinicIds.length > 0) {
    await supabase
      .from("portal_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadClinicIds);
  }

  return NextResponse.json({ messages: messages ?? [] });
}

// ── POST /api/p/messages ─────────────────────────────────────────────────────
// Patient sends a message to the clinic.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const { token, message } = body as { token?: string; message?: string };

  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 400 });

  const text = typeof message === "string" ? message.trim() : "";
  if (!text || text.length > 2000) {
    return NextResponse.json({ error: "Mensagem inválida (1–2000 caracteres)." }, { status: 422 });
  }

  const link = await validatePortalToken(token);
  if (!link) return NextResponse.json({ error: "Link inválido ou expirado." }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  const { data: inserted, error } = await supabase
    .from("portal_messages")
    .insert({
      clinic_id:  link.clinic_id,
      patient_id: link.patient_id,
      direction:  "patient_to_clinic",
      body:       text,
      created_by: null, // null = patient
    })
    .select("id, direction, body, read_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Erro ao enviar mensagem." }, { status: 500 });

  // ── Notify clinic: push + email (non-blocking) ────────────────────────────
  const [{ data: patient }, { data: clinic }] = await Promise.all([
    supabase.from("patients").select("full_name, email").eq("id", link.patient_id).maybeSingle(),
    supabase.from("clinics").select("id, name").eq("id", link.clinic_id).maybeSingle(),
  ]);

  const patientName = (patient?.full_name as string | null) ?? "Paciente";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Push to all clinic staff
  void sendPushToClinic(link.clinic_id, {
    title: `💬 Nova mensagem — ${patientName}`,
    body: text.length > 100 ? text.slice(0, 97) + "…" : text,
    url: `${appUrl}/patients/${link.patient_id}/messages`,
    tag: `msg-${link.patient_id}`,
  });

  // Email to clinic owner / first active user
  const { data: clinicUsers } = await supabase
    .from("clinic_users")
    .select("users(email)")
    .eq("clinic_id", link.clinic_id)
    .eq("status", "active")
    .limit(3);

  const emails = (clinicUsers ?? [])
    .map((cu) => (cu.users as unknown as { email: string } | null)?.email)
    .filter(Boolean) as string[];

  const clinicLocale = await resolveClinicLocale(link.clinic_id);
  for (const email of emails) {
    void sendClinicMessageAlert({
      to: email,
      clinicName: (clinic?.name as string | null) ?? "Clínica",
      patientName,
      messagePreview: text,
      inboxUrl: `${appUrl}/patients/${link.patient_id}/messages`,
      locale: clinicLocale,
    });
  }

  return NextResponse.json({ message: inserted }, { status: 201 });
}
