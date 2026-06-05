import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { scheduleAutomations } from "@/services/automation-service";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import { detectLanguage } from "@/lib/whatsapp-lang";
import { createLogger } from "@/lib/logger";
import { DEFAULT_FROM_EMAIL, APP_URL } from "@/lib/constants";

const log = createLogger("book");

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
    supabase.from("session_types").select("id, name, duration_minutes, price_cents, is_online").eq("clinic_id", clinic.id).eq("is_active", true).order("name"),
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
  if (isNaN(startsAtDate.getTime())) {
    return NextResponse.json({ error: "Data de agendamento inválida.", code: "DATE_INVALID_FORMAT" }, { status: 400 });
  }
  if (startsAtDate <= now) {
    return NextResponse.json({ error: "Data de agendamento inválida.", code: "DATE_IN_PAST" }, { status: 400 });
  }
  if (startsAtDate > oneYearFromNow) {
    return NextResponse.json({ error: "Data de agendamento inválida.", code: "DATE_TOO_FAR" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!clinic) return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });

  // Fetch is_online alongside other session type fields
  const { data: sessionType } = await supabase
    .from("session_types")
    .select("id, name, duration_minutes, is_online")
    .eq("id", session_type_id)
    .eq("clinic_id", clinic.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!sessionType) return NextResponse.json({ error: "Tipo de sessão não encontrado." }, { status: 404 });

  // Find or create patient
  const normalizedPhone = phone.replace(/\s/g, "");
  let patientId: string;

  // BUG-01: separate .eq() calls to avoid PostgREST filter injection
  // SEC-05: fetch existing email so we only update if the field was empty
  const { data: existing } = await supabase
    .from("patients")
    .select("id, email")
    .eq("clinic_id", clinic.id)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  let existingByEmail: { id: string; email: string | null } | null = null;
  if (!existing && email) {
    const { data } = await supabase
      .from("patients")
      .select("id, email")
      .eq("clinic_id", clinic.id)
      .eq("email", email)
      .maybeSingle();
    existingByEmail = data ?? null;
  }

  const existingPatient = existing ?? existingByEmail;

  if (existingPatient) {
    patientId = existingPatient.id;
    // SEC-05: only enrich record if fields were previously empty
    const updates: Record<string, string> = {};
    if (email && !existingPatient.email) updates.email = email;
    if (Object.keys(updates).length > 0) {
      await supabase.from("patients").update(updates).eq("id", patientId);
    }
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

  // Questionários automáticos na 1ª sessão (fire-and-forget; usa admin client)
  import("@/services/onboarding-assessment-service").then(({ sendOnboardingAssessments }) =>
    sendOnboardingAssessments({ id: appointment.id, clinic_id: appointment.clinic_id, patient_id: appointment.patient_id }).catch(() => {})
  );

  // ── Zoom meeting (non-blocking) ─────────────────────────────────────────────
  // If the session type is online, create a Zoom meeting and store the URLs.
  // The join_url is returned to the patient so the booking page can display it.
  let zoomJoinUrl: string | null = null;

  if (sessionType.is_online) {
    try {
      const { createZoomMeeting } = await import("@/services/zoom-service");
      const firstName = full_name.split(" ")[0];
      const meeting = await createZoomMeeting(clinic.id, {
        topic:           `${sessionType.name} — ${full_name}`,
        startIso:        starts_at,
        durationMinutes: sessionType.duration_minutes,
        autoRecord:      true,
      });

      if (meeting) {
        zoomJoinUrl = meeting.join_url;
        await supabase.from("appointments").update({
          zoom_meeting_id: meeting.meeting_id,
          zoom_join_url:   meeting.join_url,
          zoom_start_url:  meeting.start_url,
        }).eq("id", appointment.id);

        log.info("Zoom meeting created for booking", {
          appointment_id: appointment.id,
          clinic_id: clinic.id,
          meeting_id: meeting.meeting_id,
        });

        // Send email with Zoom link if patient provided an email
        if (email) {
          sendZoomConfirmationEmail({
            to: email,
            firstName,
            clinicName: clinic.name as string,
            sessionName: sessionType.name,
            startsAt: starts_at,
            joinUrl: meeting.join_url,
          }).catch((e) => log.error("Zoom email failed", e as Error, { appointment_id: appointment.id }));
        }
      }
    } catch (e) {
      // Non-blocking — appointment was already created; Zoom failure is logged but not fatal
      log.error("Zoom meeting creation failed for booking", e as Error, {
        appointment_id: appointment.id,
        clinic_id: clinic.id,
      });
    }
  }

  // ── WhatsApp confirmation via Meta template ─────────────────────────────────
  try {
    const metaToken = process.env.META_WHATSAPP_TOKEN;
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
    if (metaToken && phoneNumberId) {
      const metaPhone = normalizedPhone.replace(/^\+/, "");

      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .select("messages")
        .eq("phone", metaPhone)
        .maybeSingle();
      const history = (conv?.messages as Array<{ role: string; content: string }> | null) ?? [];
      const lang = detectLanguage(history, "");

      const date = new Date(starts_at);
      const firstName = full_name.split(" ")[0];

      let templateName: string;
      let langCode: string;
      let dateTimeStr: string;

      if (lang === "en") {
        templateName = "booking_confirmation_en";
        langCode = "en_US";
        const dateStr = date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
        const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        dateTimeStr = `${dateStr} at ${timeStr}`;
      } else {
        templateName = "confirmacao_agendamento";
        langCode = "pt_BR";
        const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
        const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        dateTimeStr = `${dateStr} às ${timeStr}`;
      }

      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${metaToken}` },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: metaPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: langCode },
            components: [{
              type: "body",
              parameters: [
                { type: "text", text: firstName },
                { type: "text", text: dateTimeStr },
                { type: "text", text: sessionType.name },
              ],
            }],
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        log.warn("WhatsApp template failed", { error: JSON.stringify(err), phone: normalizedPhone.slice(-4) });
      }

      // If online session and we have a Zoom link, send it as a follow-up text message.
      // This works because the patient just initiated contact via the booking page
      // and the 24h window is open (or we're in a session flow).
      if (zoomJoinUrl) {
        const linkMsg = lang === "en"
          ? `🖥️ Your session will be online. Join here:\n${zoomJoinUrl}`
          : `🖥️ Sua sessão será online. Entre pela reunião:\n${zoomJoinUrl}`;

        await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${metaToken}` },
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: metaPhone,
            type: "text",
            text: { body: linkMsg },
          }),
        }).catch((e) => log.warn("Zoom WhatsApp link send failed", { error: String(e) }));
      }
    }
  } catch (e) {
    log.error("WhatsApp confirmation exception", e as Error, { appointment_id: appointment.id });
  }

  // Schedule automations (non-blocking)
  scheduleAutomations(appointment).catch(() => {});

  // Push notification to clinic staff — new online booking (non-blocking)
  const apptDate = new Date(starts_at).toLocaleString("pt-BR", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
  import("@/services/push-service").then(({ sendPushToClinic, sendPushToPatient }) =>
    Promise.allSettled([
      sendPushToClinic(clinic.id, {
        title: "Novo agendamento",
        body:  `${full_name} · ${sessionType.name} · ${apptDate}`,
        url:   "/schedule",
        tag:   `booking-${appointment.id}`,
      }),
      // Notify the patient on their device
      sendPushToPatient(patientId, {
        title: "Sessão confirmada ✓",
        body:  `${sessionType.name} · ${apptDate}`,
        tag:   `booking-confirm-${appointment.id}`,
      }),
    ])
  ).catch(() => {});

  return NextResponse.json({
    ok: true,
    appointment_id: appointment.id,
    is_online: sessionType.is_online ?? false,
    zoom_join_url: zoomJoinUrl,
  });
}

// ── Zoom confirmation email ───────────────────────────────────────────────────

async function sendZoomConfirmationEmail(opts: {
  to: string;
  firstName: string;
  clinicName: string;
  sessionName: string;
  startsAt: string;
  joinUrl: string;
}) {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const date = new Date(opts.startsAt);
  const dateStr = date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  await resend.emails.send({
    from: DEFAULT_FROM_EMAIL,
    to: opts.to,
    subject: `Link da sua sessão online — ${opts.clinicName}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0F1A2E">
        <h2 style="font-size:20px;font-weight:700;margin:0 0 8px">Sessão online confirmada 🖥️</h2>
        <p style="margin:0 0 16px;color:#6B6A66;font-size:14px">
          Olá, ${opts.firstName}! Sua sessão de <strong>${opts.sessionName}</strong>
          com <strong>${opts.clinicName}</strong> foi confirmada.
        </p>
        <div style="background:#F4F3EF;border-radius:10px;padding:16px 20px;margin-bottom:24px">
          <p style="margin:0 0 4px;font-size:13px;color:#A09E98;font-weight:600;text-transform:uppercase;letter-spacing:.05em">DATA E HORA</p>
          <p style="margin:0;font-size:16px;font-weight:600">${dateStr} às ${timeStr}</p>
        </div>
        <a href="${opts.joinUrl}"
           style="display:inline-block;background:#0F6E56;color:#fff;font-weight:600;font-size:15px;
                  padding:12px 28px;border-radius:8px;text-decoration:none;margin-bottom:20px">
          Entrar na reunião Zoom
        </a>
        <p style="font-size:12px;color:#A09E98;margin:0">
          Ou acesse diretamente:<br>
          <a href="${opts.joinUrl}" style="color:#0F6E56;word-break:break-all">${opts.joinUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #E8E6E2;margin:24px 0">
        <p style="font-size:11px;color:#A09E98;margin:0">
          Enviado por ${opts.clinicName} via AXIEL Core · <a href="${APP_URL}" style="color:#A09E98">${APP_URL}</a>
        </p>
      </div>
    `,
  });
}
