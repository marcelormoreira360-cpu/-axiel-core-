import { createSupabaseServerClient } from "@/lib/supabase-server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NpsTrendPoint {
  month: string;   // "jan/25"
  score: number;   // monthly average (0-10), 0 when no data
  count: number;   // responses that month
}

export interface NpsKPIs {
  total: number;
  avgScore: number;           // 0-10
  npsIndex: number;           // -100 to 100
  promotersPct: number;       // % 9-10
  passivesPct: number;        // % 7-8
  detractorsPct: number;      // % 0-6
  trend: NpsTrendPoint[];     // last 6 months
  recentComments: { text: string; score: number; date: string }[];
}

export interface OccupancyKPIs {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  scheduled: number;           // upcoming (not yet occurred)
  completionRate: number;      // completed / (completed + cancelled + noShow)
  bySource: { source: string; count: number }[];
}

export interface InactivePatient {
  patientId: string;
  patientName: string;
  lastAppointment: string;    // ISO
  daysSince: number;
}

export interface LowPackageAlert {
  patientId: string;
  patientName: string;
  packageName: string;
  sessionsRemaining: number;
}

export interface AlertsKPIs {
  inactivePatients: InactivePatient[];
  inactiveCount: number;
  lowPackages: LowPackageAlert[];
  pendingFeedbackCount: number;
}

// ── NPS ───────────────────────────────────────────────────────────────────────

export async function getNpsKPIs(clinicId: string): Promise<NpsKPIs> {
  const supabase = await createSupabaseServerClient();

  const { data: allFeedback } = await supabase
    .from("session_feedback")
    .select("nps_score, feedback_text, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false });

  const feedback = allFeedback ?? [];
  const total = feedback.length;

  if (total === 0) {
    return {
      total: 0, avgScore: 0, npsIndex: 0,
      promotersPct: 0, passivesPct: 0, detractorsPct: 0,
      trend: buildEmptyTrend(), recentComments: [],
    };
  }

  const promoters  = feedback.filter((f) => f.nps_score >= 9).length;
  const passives   = feedback.filter((f) => f.nps_score >= 7 && f.nps_score <= 8).length;
  const detractors = feedback.filter((f) => f.nps_score <= 6).length;

  const avgScore      = feedback.reduce((s, f) => s + f.nps_score, 0) / total;
  const promotersPct  = Math.round((promoters  / total) * 100);
  const passivesPct   = Math.round((passives   / total) * 100);
  const detractorsPct = Math.round((detractors / total) * 100);
  const npsIndex      = promotersPct - detractorsPct;

  // Monthly trend — last 6 months
  const trend: NpsTrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const slice = feedback.filter((f) => f.created_at >= start && f.created_at <= end);
    const avg   = slice.length > 0 ? slice.reduce((s, f) => s + f.nps_score, 0) / slice.length : 0;
    trend.push({
      month: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      score: slice.length > 0 ? Math.round(avg * 10) / 10 : 0,
      count: slice.length,
    });
  }

  // Last 5 written comments
  const recentComments = feedback
    .filter((f) => f.feedback_text && f.feedback_text.trim())
    .slice(0, 5)
    .map((f) => ({
      text: (f.feedback_text as string).trim(),
      score: f.nps_score as number,
      date: f.created_at as string,
    }));

  return { total, avgScore: Math.round(avgScore * 10) / 10, npsIndex, promotersPct, passivesPct, detractorsPct, trend, recentComments };
}

function buildEmptyTrend(): NpsTrendPoint[] {
  const trend: NpsTrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    trend.push({ month: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), score: 0, count: 0 });
  }
  return trend;
}

// ── Occupancy ─────────────────────────────────────────────────────────────────

export async function getOccupancyKPIs(clinicId: string): Promise<OccupancyKPIs> {
  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data: appts } = await supabase
    .from("appointments")
    .select("status, source, starts_at")
    .eq("clinic_id", clinicId)
    .gte("starts_at", monthStart)
    .lte("starts_at", monthEnd);

  const rows = appts ?? [];
  const nowIso = now.toISOString();

  const completed  = rows.filter((a) => a.status === "completed").length;
  const cancelled  = rows.filter((a) => a.status === "cancelled").length;
  const noShow     = rows.filter((a) => a.status === "no_show").length;
  const scheduled  = rows.filter((a) => (a.status === "scheduled" || a.status === "confirmed") && a.starts_at > nowIso).length;
  const total      = rows.length;

  const denominator = completed + cancelled + noShow;
  const completionRate = denominator > 0 ? Math.round((completed / denominator) * 100) : 0;

  // Group by source
  const sourceMap = new Map<string, number>();
  for (const a of rows) {
    const src = (a.source as string | null) ?? "manual";
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
  }
  const SOURCE_LABELS: Record<string, string> = {
    website: "Site", portal: "Portal", whatsapp: "WhatsApp",
    manual: "Manual", instagram: "Instagram", referral: "Indicação",
  };
  const bySource = [...sourceMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ source: SOURCE_LABELS[source] ?? source, count }));

  return { total, completed, cancelled, noShow, scheduled, completionRate, bySource };
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export async function getAlertsKPIs(clinicId: string): Promise<AlertsKPIs> {
  const supabase = await createSupabaseServerClient();

  const cutoff60  = new Date(Date.now() - 60  * 24 * 60 * 60 * 1000).toISOString();
  const cutoff30  = new Date(Date.now() - 30  * 24 * 60 * 60 * 1000).toISOString();
  const nowIso    = new Date().toISOString();

  const [
    { data: recentApptPatients },
    { data: oldAppts },
    { data: lowPkgs },
    { data: pastAppts30 },
    { data: feedbackAppts30 },
  ] = await Promise.all([
    // Patients with appointment in last 60 days
    supabase
      .from("appointments")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", cutoff60),

    // Appointments older than 60 days (to find inactive patients)
    supabase
      .from("appointments")
      .select("patient_id, starts_at, patients(id, full_name)")
      .eq("clinic_id", clinicId)
      .lt("starts_at", cutoff60)
      .order("starts_at", { ascending: false })
      .limit(500),

    // Active packages with ≤ 2 sessions remaining
    supabase
      .from("patient_packages")
      .select("name, sessions_total, sessions_used, patient_id, patients(id, full_name)")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),

    // Past appointments in last 30 days (for pending NPS)
    supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .lt("starts_at", nowIso)
      .gte("starts_at", cutoff30),

    // Appointments that already have feedback
    supabase
      .from("session_feedback")
      .select("appointment_id")
      .eq("clinic_id", clinicId)
      .gte("created_at", cutoff30),
  ]);

  // ── Inactive patients ─────────────────────────────────────────────────────
  const recentIds = new Set((recentApptPatients ?? []).map((a) => a.patient_id as string));
  const seen      = new Set<string>();
  const inactivePatients: InactivePatient[] = [];
  const now = Date.now();

  for (const appt of (oldAppts ?? [])) {
    const pid = appt.patient_id as string;
    if (!recentIds.has(pid) && !seen.has(pid)) {
      seen.add(pid);
      const patient = (appt.patients as unknown) as { id: string; full_name: string } | null;
      const lastMs  = new Date(appt.starts_at as string).getTime();
      inactivePatients.push({
        patientId:      pid,
        patientName:    patient?.full_name ?? "—",
        lastAppointment: appt.starts_at as string,
        daysSince:      Math.floor((now - lastMs) / (24 * 60 * 60 * 1000)),
      });
      if (inactivePatients.length >= 10) break;
    }
  }

  // ── Low packages ──────────────────────────────────────────────────────────
  const lowPackages: LowPackageAlert[] = (lowPkgs ?? [])
    .map((pkg) => {
      const patient = (pkg.patients as unknown) as { id: string; full_name: string } | null;
      const remaining = (pkg.sessions_total ?? 0) - (pkg.sessions_used ?? 0);
      return {
        patientId:         pkg.patient_id as string,
        patientName:       patient?.full_name ?? "—",
        packageName:       pkg.name as string,
        sessionsRemaining: Math.max(0, remaining),
      };
    })
    .filter((p) => p.sessionsRemaining <= 2)
    .sort((a, b) => a.sessionsRemaining - b.sessionsRemaining)
    .slice(0, 10);

  // ── Pending NPS ───────────────────────────────────────────────────────────
  const feedbackIds         = new Set((feedbackAppts30 ?? []).map((f) => f.appointment_id as string));
  const pendingFeedbackCount = (pastAppts30 ?? []).filter((a) => !feedbackIds.has(a.id as string)).length;

  return {
    inactivePatients,
    inactiveCount: seen.size,
    lowPackages,
    pendingFeedbackCount,
  };
}
