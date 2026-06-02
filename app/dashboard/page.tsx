import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { DashboardGreeting } from "./greeting";
import { getClinicsForUser, getCurrentClinic } from "@/services/clinic-service";
import { getAppointments } from "@/services/appointment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getPendingAiInsightReviewCount } from "@/services/ai-insight-service";
import { getDashboardKPIs } from "@/modules/dashboard/dashboard-kpis";
import { getRevenueChartData } from "@/modules/dashboard/dashboard-charts";
import { getDashboardAlerts } from "@/services/dashboard-alerts-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SetupProgressBanner } from "@/components/setup-progress-banner";
import { DashboardRealtimeKpis } from "@/components/dashboard/dashboard-realtime-kpis";
import dynamic from "next/dynamic";
const RevenueChart = dynamic(
  () => import("@/components/dashboard/revenue-chart").then((m) => m.RevenueChart),
  { loading: () => <div className="h-40 rounded-[12px] bg-black/[.03] animate-pulse" /> },
);
import { TodayAgenda } from "@/components/dashboard/today-agenda";
import type { SetupTask } from "@/components/setup-progress-banner";

async function getSetupTasks(clinic: { id: string; logo_url: string | null; primary_color: string | null }): Promise<SetupTask[]> {
  const supabase = await createSupabaseServerClient();
  const t = await getTranslations("dashboard.setup");
  const [patients, sessions, leads, forms] = await Promise.all([
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id).not("email", "eq", "paciente-demo@exemplo.com"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id).not("email", "eq", "lead-demo@exemplo.com"),
    supabase.from("intake_forms").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id),
  ]);
  return [
    { key: "patient",  title: t("patient"),  href: "/patients/new",      done: (patients.count ?? 0) > 0 },
    { key: "lead",     title: t("lead"),     href: "/leads/new",         done: (leads.count ?? 0) > 0 },
    { key: "session",  title: t("session"),  href: "/schedule/new",      done: (sessions.count ?? 0) > 0 },
    { key: "intake",   title: t("intake"),   href: "/forms/new",         done: (forms.count ?? 0) > 0 },
    { key: "branding", title: t("branding"), href: "/settings/branding", done: !!(clinic.logo_url || clinic.primary_color) },
  ];
}

function firstName(fullName?: string | null, email?: string | null) {
  if (fullName?.trim()) return fullName.trim().split(/\s+/)[0];
  if (email?.includes("@")) return email.split("@")[0];
  return "";
}


export default async function Dashboard() {
  // PERF: single round-trip — all data fetched in parallel
  const [profile, clinics, currentClinic, appointments] = await Promise.all([
    getCurrentUserProfile().catch(() => null),
    getClinicsForUser().catch(() => []),
    getCurrentClinic().catch(() => null),
    getAppointments().catch(() => []),
  ]);

  const clinic = currentClinic ?? clinics[0] ?? null;

  if (!clinic && !profile?.clinic_id) {
    redirect("/onboarding");
  }

  const [pendingReviews, alerts, kpis, chartData, setupTasks] = await Promise.all([
    getPendingAiInsightReviewCount(clinic?.id).catch(() => 0),
    clinic
      ? getDashboardAlerts(clinic.id).catch(() => ({ packageAlerts: [], biomarkerAlerts: [] }))
      : Promise.resolve({ packageAlerts: [], biomarkerAlerts: [] }),
    clinic
      ? getDashboardKPIs(clinic.id).catch(() => ({ revenueThisMonth: 0, revenueLastMonth: 0, sessionsThisMonth: 0, sessionsLastMonth: 0, returnRate: 0, returnRateBase: 0 }))
      : Promise.resolve({ revenueThisMonth: 0, revenueLastMonth: 0, sessionsThisMonth: 0, sessionsLastMonth: 0, returnRate: 0, returnRateBase: 0 }),
    // PERF: chart data and setup tasks run in parallel with KPIs
    clinic ? getRevenueChartData(clinic.id, 6).catch(() => []) : Promise.resolve([]),
    clinic ? getSetupTasks(clinic).catch(() => []) : Promise.resolve([]),
  ]);

  const today = new Date().toDateString();
  const todayAppts = appointments.filter((a) => new Date(a.starts_at).toDateString() === today);
  const totalAlerts = alerts.packageAlerts.length + alerts.biomarkerAlerts.length + pendingReviews;
  const name = firstName(profile?.full_name, profile?.email);

  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const knownProfiles = ["integrativa", "fisioterapia", "saude_mental", "nutricao", "wellness"];

  const quickActions = [
    { label: t("quickActions.newPatient"),      href: "/patients/new", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" },
    { label: t("quickActions.scheduleSession"), href: "/schedule/new", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
    { label: t("quickActions.leadsPipeline"),   href: "/leads",        icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
    { label: t("quickActions.reports"),         href: "/relatorios",   icon: "M18 20V10M12 20V4M6 20v-6" },
  ];

  return (
    <Shell userName={profile?.full_name} userRole={profile?.role ? tc(`roles.${profile.role}`) : undefined}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-[20px]">
        <div>
          <DashboardGreeting name={name} />
          <div className="flex items-center gap-[8px] mt-[4px] flex-wrap">
            {clinic?.clinic_profile && (
              <span className="text-[10px] font-medium px-[8px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">
                {knownProfiles.includes(clinic.clinic_profile)
                  ? tc(`clinicProfile.${clinic.clinic_profile}`)
                  : clinic.clinic_profile}
              </span>
            )}
            <p className="text-[12px] text-[#A09E98]">
              {t("attention", { count: totalAlerts })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalAlerts > 0 && (
            <div className="relative">
              <div className="w-8 h-8 rounded-[8px] bg-white border border-black/[.08] flex items-center justify-center text-[#6B6A66]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center">
                {totalAlerts > 9 ? "9+" : totalAlerts}
              </span>
            </div>
          )}
          <div className="w-8 h-8 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[10px] font-semibold text-[#0F6E56] select-none">
            {name.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Setup progress ── */}
      {setupTasks.length > 0 && (
        <div className="mb-[18px]">
          <SetupProgressBanner tasks={setupTasks} />
        </div>
      )}

      {/* ── KPI Cards — realtime via Supabase postgres_changes ── */}
      {clinic && (
        <DashboardRealtimeKpis
          clinicId={clinic.id}
          initialKpis={kpis}
          initialTodayCount={todayAppts.length}
        />
      )}

      {/* ── Chart + Agenda ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-[12px] mb-[14px]" style={{ minHeight: 280 }}>
        <RevenueChart data={chartData} />
        <TodayAgenda appointments={appointments} />
      </div>

      {/* ── Alerts + Actions + Week ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[12px]">

        {/* Package alerts */}
        {alerts.packageAlerts.length > 0 && (
          <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] p-[15px]">
            <div className="flex items-center gap-[6px] mb-[10px]">
              <div className="w-[18px] h-[18px] rounded-[4px] bg-amber-50 flex items-center justify-center shrink-0">
                <svg className="w-[10px] h-[10px] text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <p className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{t("packageAlerts.title")}</p>
              <span className="ml-auto text-[10px] font-medium bg-amber-50 text-amber-600 rounded-full px-[7px] py-[1px]">
                {alerts.packageAlerts.length}
              </span>
            </div>
            <div className="space-y-[4px]">
              {alerts.packageAlerts.slice(0, 4).map((pkg) => (
                <Link
                  key={pkg.patientId + pkg.packageName}
                  href={`/patients/${pkg.patientId}`}
                  className="flex items-center justify-between rounded-[8px] bg-amber-50 hover:bg-amber-100 px-[10px] py-[8px] transition"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#0F1A2E] truncate">{pkg.patientName}</p>
                    <p className="text-[10px] text-amber-600 mt-[1px] truncate">{pkg.packageName}</p>
                  </div>
                  <span className={`text-[12px] font-semibold ml-2 shrink-0 ${pkg.remaining <= 0 ? "text-red-500" : "text-amber-500"}`}>
                    {pkg.remaining <= 0 ? t("packageAlerts.exhausted") : t("packageAlerts.remaining", { count: pkg.remaining })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Biomarker alerts */}
        {alerts.biomarkerAlerts.length > 0 && (
          <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] p-[15px]">
            <div className="flex items-center gap-[6px] mb-[10px]">
              <div className="w-[18px] h-[18px] rounded-[4px] bg-red-50 flex items-center justify-center shrink-0">
                <svg className="w-[10px] h-[10px] text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
              </div>
              <p className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{t("biomarkerAlerts.title")}</p>
              <span className="ml-auto text-[10px] font-medium bg-red-50 text-red-500 rounded-full px-[7px] py-[1px]">
                {alerts.biomarkerAlerts.length}
              </span>
            </div>
            <div className="space-y-[2px]">
              {alerts.biomarkerAlerts.slice(0, 4).map((alert, i) => (
                <Link
                  key={i}
                  href={`/patients/${alert.patientId}/evolution`}
                  className="flex items-center justify-between rounded-[8px] px-[10px] py-[7px] hover:bg-[#FAFAF8] dark:hover:bg-white/[.03] transition"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] truncate">{alert.patientName}</p>
                    <p className="text-[10px] text-[#A09E98] truncate">{alert.biomarker}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-[7px] py-[2px] rounded-full ml-2 shrink-0 ${alert.status === "high" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"}`}>
                    {alert.status === "high" ? tc("status.high") : tc("status.low")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Insights pendentes */}
        {pendingReviews > 0 && (
          <div className="bg-[#F0FAF6] dark:bg-[#0F6E56]/[.10] border border-[#9FE1CB]/50 rounded-[12px] p-[15px]">
            <div className="flex items-center gap-[6px] mb-[8px]">
              <svg className="w-[13px] h-[13px] text-[#0F6E56]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
              <p className="text-[11px] font-semibold uppercase tracking-[.07em] text-[#0F6E56]">{t("aiInsights.title")}</p>
            </div>
            <p className="text-[12px] text-[#085041] dark:text-[#9FE1CB] mb-[10px]">
              {t("aiInsights.pending", { count: pendingReviews })}
            </p>
            <Link href="/actions" className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] hover:underline">
              {t("aiInsights.reviewNow")}
            </Link>
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] p-[15px]">
          <p className="text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[10px]">{t("quickActions.title")}</p>
          <div className="space-y-[2px]">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}
                className="flex items-center gap-[10px] rounded-[8px] px-[10px] py-[9px] hover:bg-[#F4F3EF] dark:hover:bg-white/[.04] transition group"
              >
                <div className="w-[26px] h-[26px] rounded-[7px] bg-[#F4F3EF] dark:bg-white/[.06] group-hover:bg-[#E1F5EE] flex items-center justify-center shrink-0 transition">
                  <svg className="w-[13px] h-[13px] text-[#6B6A66] group-hover:text-[#0F6E56] transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={action.icon} />
                  </svg>
                </div>
                <span className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] flex-1">{action.label}</span>
                <svg className="w-3 h-3 text-[#D3D1C7] group-hover:text-[#A09E98] transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* Week summary */}
        <div className="bg-[#0F1A2E] dark:bg-[#0A0F1A] rounded-[12px] p-[15px]">
          <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-white/40 mb-[12px]">{t("week.title")}</p>
          <div className="space-y-[10px]">
            {(() => {
              // L-03: use Mon–Sun week, not rolling 7 days
              const now = new Date();
              const dayOfWeek = now.getDay(); // 0=Sun … 6=Sat
              const daysSinceMonday = (dayOfWeek + 6) % 7; // 0 on Mon, 6 on Sun
              const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday).getTime();
              const weekEnd   = weekStart + 7 * 24 * 60 * 60 * 1000; // exclusive upper bound
              const weekAppts = appointments.filter((a) => {
                const t = new Date(a.starts_at).getTime();
                return t >= weekStart && t < weekEnd;
              });
              return [
                { label: t("week.scheduled"), value: weekAppts.length },
                { label: t("week.completed"), value: weekAppts.filter((a) => a.status === "completed").length },
                { label: t("week.cancelled"), value: weekAppts.filter((a) => a.status === "cancelled").length },
              ];
            })().map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <p className="text-[12px] text-white/50">{item.label}</p>
                <p className="text-[15px] font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-[14px] pt-[12px] border-t border-white/[.07]">
            <Link href="/relatorios" className="text-[11px] font-medium text-white/40 hover:text-white/70 transition">
              {t("week.fullReports")}
            </Link>
          </div>
        </div>

      </div>
    </Shell>
  );
}
