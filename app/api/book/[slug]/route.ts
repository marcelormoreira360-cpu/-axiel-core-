import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import { canUseFeature } from "@/modules/billing/feature-access";
import { createPublicBooking } from "@/services/appointment-service";
import { localeFromAcceptLanguage } from "@/i18n/get-locale";
import { isLocale } from "@/i18n/locales";

export const runtime = "nodejs";

// GET /api/book/[slug] — public clinic info + session types
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createSupabaseAdminClient();

  // Idioma de exibição = cookie do site público -> Accept-Language -> default.
  // Os nomes dos serviços saem no idioma do paciente (fallback = nome base).
  const cookieLocale = req.cookies.get("AXIEL_LOCALE")?.value;
  const displayLocale = isLocale(cookieLocale)
    ? cookieLocale
    : localeFromAcceptLanguage(req.headers.get("accept-language"));

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, slug, logo_url, primary_color")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!clinic) return NextResponse.json({ error: "Clínica não encontrada." }, { status: 404 });

  const [{ data: sessionTypes }, { data: workingHours }, { data: practitionersRaw }, { data: clinicSettings }, { data: subscription }, { data: sttRows }] = await Promise.all([
    supabase.from("session_types").select("id, name, duration_minutes, price_cents, is_online").eq("clinic_id", clinic.id).eq("is_active", true).order("name"),
    supabase.from("working_hours").select("day_of_week, opens_at, closes_at, is_open").eq("clinic_id", clinic.id),
    supabase.from("clinic_users").select("user_id, display_name, specialty, bio, users(full_name)").eq("clinic_id", clinic.id).eq("status", "active").eq("is_bookable", true),
    supabase.from("clinic_settings").select("settings").eq("clinic_id", clinic.id).maybeSingle(),
    supabase.from("subscriptions").select("plans(code, slug)").eq("clinic_id", clinic.id).maybeSingle(),
    supabase.from("session_type_translations").select("session_type_id, name").eq("clinic_id", clinic.id).eq("locale", displayLocale),
  ]);

  // Nome do serviço no idioma do paciente (fallback = nome base em session_types.name).
  const nameByType = new Map((sttRows ?? []).map((r) => [r.session_type_id, r.name]));
  const localizedSessionTypes = (sessionTypes ?? []).map((s) => ({ ...s, name: nameByType.get(s.id) ?? s.name }));

  // L-05: include the clinic's configured currency in the public response
  const currency = (clinicSettings?.settings as Record<string, unknown> | null)?.default_currency as string ?? "BRL";

  // PLG: rodapé "Powered by AXIEL" — oculto para clínicas com white_label (Enterprise)
  const subscriptionPlans = subscription?.plans as { code?: string | null; slug?: string | null } | null;
  const planSlug = subscriptionPlans?.code ?? subscriptionPlans?.slug ?? "starter";
  const showPoweredBy = !canUseFeature({ planSlug }, "white_label");

  const practitioners = (practitionersRaw ?? []).map((p) => {
    const usersData = p.users as unknown as { full_name: string } | null;
    return {
      id: p.user_id,
      display_name: p.display_name ?? usersData?.full_name ?? "Profissional",
      specialty: p.specialty ?? null,
      bio: p.bio ?? null,
    };
  });

  return NextResponse.json({ clinic: { ...clinic, currency, show_powered_by: showPoweredBy }, sessionTypes: localizedSessionTypes, workingHours: workingHours ?? [], practitioners });
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

  // Idioma preferido do paciente, capturado do cookie do site público.
  // Validado contra os locales suportados; ausente/ inválido = null (herda da clínica).
  const rawLocale = req.cookies.get("AXIEL_LOCALE")?.value;
  const bookingLocale =
    rawLocale === "pt-BR" || rawLocale === "en" || rawLocale === "pt-PT" ? rawLocale : null;

  // Criação + side-effects vivem no service (compartilhado com o canal de voz).
  const result = await createPublicBooking({
    slug,
    session_type_id,
    starts_at,
    full_name,
    email,
    phone,
    notes,
    practitioner_id,
    locale: bookingLocale,
    source: "website",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    appointment_id: result.appointment_id,
    is_online: result.is_online,
    zoom_join_url: result.zoom_join_url,
  });
}
