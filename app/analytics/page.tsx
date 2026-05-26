import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getNpsKPIs, getOccupancyKPIs, getAlertsKPIs } from "@/modules/analytics/analytics-kpis";
import dynamicImport from "next/dynamic";
const NpsTrendChart = dynamicImport(
  () => import("@/components/analytics/nps-trend-chart").then((m) => m.NpsTrendChart),
  { ssr: false, loading: () => <div className="h-32 rounded-[12px] bg-black/[.03] animate-pulse" /> },
);

export const metadata: Metadata = { title: "Analytics | AXIEL Core" };
export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────────

function npsColor(score: number): string {
  if (score >= 50) return "#0F6E56";
  if (score >= 0)  return "#D97706";
  return "#DC2626";
}

function npsLabel(score: number): string {
  if (score >= 70) return "Excelente";
  if (score >= 50) return "Muito bom";
  if (score >= 30) return "Bom";
  if (score >= 0)  return "Atenção";
  return "Crítico";
}

function scoreColor(score: number): string {
  if (score >= 9) return "#0F6E56";
  if (score >= 7) return "#D97706";
  return "#DC2626";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function daysSinceLabel(days: number): string {
  if (days >= 365) return `${Math.floor(days / 30)} meses`;
  if (days >= 30)  return `${Math.floor(days / 30)} m`;
  return `${days}d`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const clinic = await getCurrentClinic();

  const [nps, occupancy, alerts] = await Promise.all([
    clinic ? getNpsKPIs(clinic.id) : null,
    clinic ? getOccupancyKPIs(clinic.id) : null,
    clinic ? getAlertsKPIs(clinic.id) : null,
  ]);

  const { data: profile } = user
    ? await supabase.from("users").select("full_name, role").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <Shell userName={profile?.full_name} userRole={profile?.role}>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* ── Page header ────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">Analytics</h1>
          <p className="mt-1 text-sm text-black/50 dark:text-white/40">
            Inteligência clínica em tempo real — NPS, ocupação e alertas.
          </p>
        </div>

        {!clinic ? (
          <p className="text-sm text-black/40">Nenhuma clínica encontrada.</p>
        ) : (
          <>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 1 — NPS & Satisfação
            ═══════════════════════════════════════════════════════════ */}
            <section className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/30">
                NPS & Satisfação
              </h2>

              {nps && nps.total === 0 ? (
                <div className="bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-6 text-center text-sm text-black/40">
                  Nenhuma avaliação registrada ainda. As avaliações aparecerão aqui assim que os pacientes responderem.
                </div>
              ) : nps ? (
                <>
                  {/* Top row: NPS index + avg score + totals */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* NPS Index */}
                    <div className="col-span-2 md:col-span-1 bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-1">Índice NPS</p>
                      <p className="text-3xl font-bold" style={{ color: npsColor(nps.npsIndex) }}>
                        {nps.npsIndex > 0 ? "+" : ""}{nps.npsIndex}
                      </p>
                      <p className="text-xs font-medium mt-1" style={{ color: npsColor(nps.npsIndex) }}>
                        {npsLabel(nps.npsIndex)}
                      </p>
                      <p className="text-[11px] text-black/30 dark:text-white/20 mt-2">{nps.total} avaliação{nps.total !== 1 ? "ões" : ""}</p>
                    </div>

                    {/* Promotores */}
                    <div className="bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-1">Promotores</p>
                      <p className="text-2xl font-bold text-[#0F6E56]">{nps.promotersPct}%</p>
                      <p className="text-[11px] text-black/30 dark:text-white/20 mt-1">nota 9-10</p>
                    </div>

                    {/* Passivos */}
                    <div className="bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-1">Passivos</p>
                      <p className="text-2xl font-bold text-[#D97706]">{nps.passivesPct}%</p>
                      <p className="text-[11px] text-black/30 dark:text-white/20 mt-1">nota 7-8</p>
                    </div>

                    {/* Detratores */}
                    <div className="bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-1">Detratores</p>
                      <p className="text-2xl font-bold text-[#DC2626]">{nps.detractorsPct}%</p>
                      <p className="text-[11px] text-black/30 dark:text-white/20 mt-1">nota 0-6</p>
                    </div>
                  </div>

                  {/* Trend chart + recent comments */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-3">
                        Tendência (6 meses)
                      </p>
                      <NpsTrendChart data={nps.trend} />
                    </div>

                    <div className="bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-3">
                        Comentários recentes
                      </p>
                      {nps.recentComments.length === 0 ? (
                        <p className="text-sm text-black/30 dark:text-white/20">Nenhum comentário ainda.</p>
                      ) : (
                        <div className="space-y-3">
                          {nps.recentComments.map((c, i) => (
                            <div key={i} className="border-b border-black/[.05] dark:border-white/[.05] pb-3 last:border-0 last:pb-0">
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: scoreColor(c.score) }}
                                >
                                  {c.score}
                                </span>
                                <span className="text-[11px] text-black/30 dark:text-white/20">{formatDate(c.date)}</span>
                              </div>
                              <p className="text-sm text-[#0F1A2E] dark:text-[#E8E6E2] leading-relaxed line-clamp-2">{c.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 2 — Ocupação
            ═══════════════════════════════════════════════════════════ */}
            <section className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/30">
                Ocupação — {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </h2>

              {occupancy && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Completion rate */}
                    <div className="col-span-2 md:col-span-1 bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-1">Taxa de realização</p>
                      <p className="text-3xl font-bold text-[#0F1A2E] dark:text-[#E8E6E2]">{occupancy.completionRate}%</p>
                      <p className="text-[11px] text-black/30 dark:text-white/20 mt-2">{occupancy.total} sessões este mês</p>
                    </div>

                    <div className="bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-1">Concluídas</p>
                      <p className="text-2xl font-bold text-[#0F6E56]">{occupancy.completed}</p>
                      <p className="text-[11px] text-black/30 dark:text-white/20 mt-1">realizadas</p>
                    </div>

                    <div className="bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-1">Canceladas</p>
                      <p className="text-2xl font-bold text-[#D97706]">{occupancy.cancelled}</p>
                      <p className="text-[11px] text-black/30 dark:text-white/20 mt-1">cancelamentos</p>
                    </div>

                    <div className="bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-1">Não compareceu</p>
                      <p className="text-2xl font-bold text-[#DC2626]">{occupancy.noShow}</p>
                      <p className="text-[11px] text-black/30 dark:text-white/20 mt-1">no-shows</p>
                    </div>
                  </div>

                  {/* Source breakdown */}
                  {occupancy.bySource.length > 0 && (
                    <div className="bg-white dark:bg-[#1C2333] rounded-2xl border border-black/[.07] dark:border-white/[.07] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40 dark:text-white/30 mb-4">
                        Origem dos agendamentos
                      </p>
                      <div className="space-y-2">
                        {occupancy.bySource.map((s) => {
                          const pct = occupancy.total > 0 ? Math.round((s.count / occupancy.total) * 100) : 0;
                          return (
                            <div key={s.source}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-[#0F1A2E] dark:text-[#E8E6E2]">{s.source}</span>
                                <span className="text-sm font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">
                                  {s.count} <span className="text-black/30 dark:text-white/20 font-normal">({pct}%)</span>
                                </span>
                              </div>
                              <div className="h-1.5 bg-black/[.06] dark:bg-white/[.06] rounded-full overflow-hidden">
                                <div className="h-full bg-[#0F6E56] rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ═══════════════════════════════════════════════════════════
                SECTION 3 — Alertas
            ═══════════════════════════════════════════════════════════ */}
            <section className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/30">
                Alertas Inteligentes
              </h2>

              {alerts && (
                <div className="space-y-3">

                  {/* Pending NPS */}
                  <div className={`rounded-2xl border p-4 flex items-center gap-4 ${
                    alerts.pendingFeedbackCount > 0
                      ? "bg-[#EFF6FF] border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30"
                      : "bg-white dark:bg-[#1C2333] border-black/[.07] dark:border-white/[.07]"
                  }`}>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${
                      alerts.pendingFeedbackCount > 0 ? "bg-blue-100 dark:bg-blue-900/30" : "bg-black/[.04] dark:bg-white/[.04]"
                    }`}>
                      ⭐
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">
                        {alerts.pendingFeedbackCount === 0
                          ? "Todas as sessões foram avaliadas"
                          : `${alerts.pendingFeedbackCount} sessão${alerts.pendingFeedbackCount !== 1 ? "ões" : ""} sem avaliação NPS`}
                      </p>
                      <p className="text-xs text-black/40 dark:text-white/30 mt-0.5">Últimos 30 dias</p>
                    </div>
                  </div>

                  {/* Low packages */}
                  <div className={`rounded-2xl border p-4 ${
                    alerts.lowPackages.length > 0
                      ? "bg-[#FFFBEB] border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/30"
                      : "bg-white dark:bg-[#1C2333] border-black/[.07] dark:border-white/[.07]"
                  }`}>
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${
                        alerts.lowPackages.length > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-black/[.04] dark:bg-white/[.04]"
                      }`}>
                        📦
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">
                          {alerts.lowPackages.length === 0
                            ? "Nenhum pacote prestes a esgotar"
                            : `${alerts.lowPackages.length} pacote${alerts.lowPackages.length !== 1 ? "s" : ""} com ≤ 2 sessões`}
                        </p>
                        <p className="text-xs text-black/40 dark:text-white/30">Pacotes ativos</p>
                      </div>
                    </div>
                    {alerts.lowPackages.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {alerts.lowPackages.map((pkg, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-black/[.04] dark:border-white/[.04] last:border-0">
                            <div className="min-w-0">
                              <Link href={`/patients/${pkg.patientId}`} className="text-sm font-medium text-[#0F1A2E] dark:text-[#E8E6E2] hover:underline truncate block">
                                {pkg.patientName}
                              </Link>
                              <p className="text-xs text-black/40 dark:text-white/30 truncate">{pkg.packageName}</p>
                            </div>
                            <span className={`shrink-0 ml-3 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              pkg.sessionsRemaining === 0
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}>
                              {pkg.sessionsRemaining === 0 ? "Esgotado" : `${pkg.sessionsRemaining} restante${pkg.sessionsRemaining !== 1 ? "s" : ""}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inactive patients */}
                  <div className={`rounded-2xl border p-4 ${
                    alerts.inactiveCount > 0
                      ? "bg-[#FFF5F5] border-red-200 dark:bg-red-950/20 dark:border-red-800/30"
                      : "bg-white dark:bg-[#1C2333] border-black/[.07] dark:border-white/[.07]"
                  }`}>
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${
                        alerts.inactiveCount > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-black/[.04] dark:bg-white/[.04]"
                      }`}>
                        💤
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">
                          {alerts.inactiveCount === 0
                            ? "Nenhum paciente inativo"
                            : `${alerts.inactiveCount} paciente${alerts.inactiveCount !== 1 ? "s" : ""} sem sessão há +60 dias`}
                        </p>
                        <p className="text-xs text-black/40 dark:text-white/30">Sem agendamento nos últimos 60 dias</p>
                      </div>
                    </div>
                    {alerts.inactivePatients.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {alerts.inactivePatients.map((p, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b border-black/[.04] dark:border-white/[.04] last:border-0">
                            <Link href={`/patients/${p.patientId}`} className="text-sm font-medium text-[#0F1A2E] dark:text-[#E8E6E2] hover:underline truncate">
                              {p.patientName}
                            </Link>
                            <span className="shrink-0 ml-3 text-xs text-red-600 dark:text-red-400 font-medium">
                              {daysSinceLabel(p.daysSince)} sem sessão
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </section>

          </>
        )}
      </div>
    </Shell>
  );
}
