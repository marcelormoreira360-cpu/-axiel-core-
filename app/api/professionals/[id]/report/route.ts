import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export interface ProfessionalReport {
  professional: {
    userId: string;
    fullName: string;
    displayName: string | null;
    specialty: string | null;
    role: string;
  };
  period: { from: string; to: string; label: string };
  // Appointments
  totalSessions: number;
  completed: number;
  cancelled: number;
  noShow: number;
  scheduled: number;
  completionRate: number;
  // Revenue
  totalRevenueCents: number;
  avgTicketCents: number;
  // NPS
  npsTotal: number;
  avgNps: number | null;
  npsIndex: number | null;
  promotersPct: number;
  detractorsPct: number;
  // Monthly trend (last 6m)
  monthlyTrend: { month: string; sessions: number; revenueCents: number }[];
  // Top session types
  bySessionType: { name: string; count: number; revenueCents: number }[];
}

function resolvePeriod(period: string) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "last_month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return { from: new Date(ly, lm, 1).toISOString(), to: new Date(ly, lm + 1, 0, 23, 59, 59).toISOString(), label: new Date(ly, lm, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
    }
    case "last_3m": return { from: new Date(y, m - 2, 1).toISOString(), to: new Date(y, m + 1, 0, 23, 59, 59).toISOString(), label: "Últimos 3 meses" };
    case "last_6m": return { from: new Date(y, m - 5, 1).toISOString(), to: new Date(y, m + 1, 0, 23, 59, 59).toISOString(), label: "Últimos 6 meses" };
    case "this_year": return { from: new Date(y, 0, 1).toISOString(), to: new Date(y, 11, 31, 23, 59, 59).toISOString(), label: `Ano ${y}` };
    default: return { from: new Date(y, m, 1).toISOString(), to: new Date(y, m + 1, 0, 23, 59, 59).toISOString(), label: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: professionalId } = await params;
  const period = req.nextUrl.searchParams.get("period") ?? "this_month";

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.clinic_id) return NextResponse.json({ error: "Sem clínica associada." }, { status: 403 });

  const clinicId = profile.clinic_id as string;
  const admin = createSupabaseAdminClient();
  const { from, to, label } = resolvePeriod(period);
  const nowIso = new Date().toISOString();

  // Verify professional belongs to clinic
  const { data: clinicUser } = await admin
    .from("clinic_users")
    .select("user_id, display_name, specialty, role, users(full_name)")
    .eq("clinic_id", clinicId)
    .eq("user_id", professionalId)
    .maybeSingle();

  if (!clinicUser) return NextResponse.json({ error: "Profissional não encontrado." }, { status: 404 });

  const profUser = (clinicUser.users as unknown) as { full_name: string } | null;

  const [{ data: appts }, { data: payments }, { data: npsRows }] = await Promise.all([
    admin
      .from("appointments")
      .select("id, status, starts_at, session_types(id, name)")
      .eq("clinic_id", clinicId)
      .eq("practitioner_id", professionalId)
      .gte("starts_at", from)
      .lte("starts_at", to),

    admin
      .from("patient_payments")
      .select("amount_cents, appointment_id, appointments!inner(practitioner_id, session_types(name))")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("paid_at", from)
      .lte("paid_at", to),

    admin
      .from("session_feedback")
      .select("nps_score, appointment_id")
      .eq("clinic_id", clinicId),
  ]);

  const rows = appts ?? [];
  const completed   = rows.filter((a) => a.status === "completed").length;
  const cancelled   = rows.filter((a) => a.status === "cancelled").length;
  const noShow      = rows.filter((a) => a.status === "no_show").length;
  const scheduled   = rows.filter((a) => (a.status === "scheduled" || a.status === "confirmed") && (a.starts_at as string) > nowIso).length;
  const denominator = completed + cancelled + noShow;

  // Revenue (filter to this professional's appointments)
  const apptIds = new Set(rows.map((a) => a.id as string));
  const filteredPayments = (payments ?? []).filter((p) => apptIds.has(p.appointment_id as string));
  const totalRevenueCents = filteredPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const avgTicketCents = completed > 0 ? Math.round(totalRevenueCents / completed) : 0;

  // NPS (filter to this professional's appointments)
  const filteredNps = (npsRows ?? []).filter((n) => apptIds.has(n.appointment_id as string));
  const npsTotal = filteredNps.length;
  const promoters  = filteredNps.filter((n) => (n.nps_score as number) >= 9).length;
  const detractors = filteredNps.filter((n) => (n.nps_score as number) <= 6).length;
  const avgNps = npsTotal > 0 ? Math.round(filteredNps.reduce((s, n) => s + (n.nps_score as number), 0) / npsTotal * 10) / 10 : null;
  const promotersPct  = npsTotal > 0 ? Math.round((promoters  / npsTotal) * 100) : 0;
  const detractorsPct = npsTotal > 0 ? Math.round((detractors / npsTotal) * 100) : 0;
  const npsIndex = npsTotal > 0 ? promotersPct - detractorsPct : null;

  // Monthly trend (last 6 months)
  const now = new Date();
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const mAppts = rows.filter((a) => (a.starts_at as string) >= mStart && (a.starts_at as string) <= mEnd);
    const mApptIds = new Set(mAppts.map((a) => a.id as string));
    const mRevenue = filteredPayments
      .filter((p) => mApptIds.has(p.appointment_id as string))
      .reduce((s, p) => s + (p.amount_cents ?? 0), 0);
    return {
      month: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      sessions: mAppts.length,
      revenueCents: mRevenue,
    };
  });

  // By session type
  const typeMap = new Map<string, { count: number; revenueCents: number }>();
  for (const a of rows) {
    const st = (a.session_types as unknown) as { id: string; name: string } | null;
    const key = st?.name ?? "Sessão avulsa";
    if (!typeMap.has(key)) typeMap.set(key, { count: 0, revenueCents: 0 });
    typeMap.get(key)!.count += 1;
  }
  for (const p of filteredPayments) {
    const appt = (p.appointments as unknown) as { session_types: { name: string } | null } | null;
    const key = appt?.session_types?.name ?? "Sessão avulsa";
    if (typeMap.has(key)) typeMap.get(key)!.revenueCents += p.amount_cents ?? 0;
  }
  const bySessionType = [...typeMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count);

  const report: ProfessionalReport = {
    professional: {
      userId: professionalId,
      fullName: profUser?.full_name ?? "—",
      displayName: clinicUser.display_name as string | null,
      specialty: clinicUser.specialty as string | null,
      role: clinicUser.role as string,
    },
    period: { from, to, label },
    totalSessions: rows.length,
    completed,
    cancelled,
    noShow,
    scheduled,
    completionRate: denominator > 0 ? Math.round((completed / denominator) * 100) : 0,
    totalRevenueCents,
    avgTicketCents,
    npsTotal,
    avgNps,
    npsIndex,
    promotersPct,
    detractorsPct,
    monthlyTrend,
    bySessionType,
  };

  return NextResponse.json(report);
}
