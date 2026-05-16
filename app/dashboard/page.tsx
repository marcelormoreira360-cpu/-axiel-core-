import Link from "next/link";
import { Shell } from "@/components/shell";
import { getClinicsForUser, getCurrentClinic } from "@/services/clinic-service";
import { getPatients } from "@/services/patient-service";
import { getLeads } from "@/services/lead-service";
import { getAppointments } from "@/services/appointment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getPendingAiInsightReviewCount } from "@/services/ai-insight-service";
import { getTodaySchedulePreview } from "@/modules/dashboard/dashboard-data";
import { getDashboardAlerts } from "@/services/dashboard-alerts-service";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function firstName(fullName?: string | null, email?: string | null) {
  if (fullName?.trim()) return fullName.trim().split(/\s+/)[0];
  if (email?.includes("@")) return email.split("@")[0];
  return "";
}

export default async function Dashboard() {
  const [profile, clinics, currentClinic, patients, leads, appointments] = await Promise.all([
    getCurrentUserProfile(),
    getClinicsForUser(),
    getCurrentClinic(),
    getPatients(),
    getLeads(),
    getAppointments(),
  ]);

  const clinic = currentClinic ?? clinics[0] ?? null;

  const [pendingReviews, alerts] = await Promise.all([
    getPendingAiInsightReviewCount(clinic?.id),
    clinic ? getDashboardAlerts(clinic.id) : Promise.resolve({ packageAlerts: [], biomarkerAlerts: [] }),
  ]);

  const today = new Date().toDateString();
  const todayAppts = appointments.filter(
    (a) => new Date(a.starts_at).toDateString() === today
  );
  const todaySchedule = getTodaySchedulePreview(appointments).slice(0, 6);
  const patientsToday = new Set(todayAppts.map((a) => a.patient_id)).size;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newLeadsCount = leads.filter(
    (l) => new Date(l.created_at).getTime() >= sevenDaysAgo
  ).length;
  const name = firstName(profile?.full_name, profile?.email);
  const totalAlerts = alerts.packageAlerts.length + alerts.biomarkerAlerts.length + pendingReviews;

  return (
    <Shell userName={profile?.full_name} userRole="Clinic owner">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-[22px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
            {getGreeting()}{name ? `, ${name}` : ""}.
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {totalAlerts > 0
              ? `${totalAlerts} item${totalAlerts > 1 ? "s" : ""} precisam da sua atenção hoje.`
              : "Tudo em ordem por hoje."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalAlerts > 0 && (
            <div className="relative">
              <div className="w-[30px] h-[30px] rounded-lg bg-white border border-black/[.1] flex items-center justify-center text-[#6B6A66]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center">
                {totalAlerts > 9 ? "9+" : totalAlerts}
              </span>
            </div>
          )}
          <div className="w-[30px] h-[30px] rounded-full bg-[#E1F5EE] flex items-center justify-center text-[10px] font-medium text-[#0F6E56] select-none">
            {name.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] mb-[18px]">
        {[
          { label: "SESSÕES HOJE", value: patientsToday, sub: patientsToday > 0 ? "agendadas" : "nenhuma hoje" },
          { label: "NOVOS LEADS", value: newLeadsCount, sub: "últimos 7 dias" },
          { label: "INSIGHTS PENDENTES", value: pendingReviews, sub: pendingReviews > 0 ? "aguardando revisão" : "em dia", green: true },
          { label: "PACIENTES ATIVOS", value: patients.length, sub: "no sistema" },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-black/[.07] rounded-[10px] p-[13px]">
            <p className="text-[10px] text-[#A09E98] tracking-[.04em] mb-[5px]">{m.label}</p>
            <p className="text-[22px] font-medium tracking-[-0.03em] text-[#0F1A2E] leading-none">{m.value}</p>
            <p className={`text-[10px] mt-[3px] ${m.green && m.value > 0 ? "text-[#0F6E56]" : "text-[#A09E98]"}`}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-[12px]">

        {/* Coluna esquerda */}
        <div className="space-y-[12px]">

          {/* Agenda do dia */}
          <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
            <div className="flex items-center justify-between mb-[12px]">
              <p className="text-[12px] font-medium text-[#0F1A2E]">Agenda de hoje</p>
              <Link href="/schedule" className="text-[11px] text-[#0F6E56] hover:underline">ver agenda</Link>
            </div>
            {todaySchedule.length > 0 ? (
              <div className="divide-y divide-black/[.04]">
                {todaySchedule.map((item, i) => (
                  <div key={`${item.time}-${i}`} className="flex items-center gap-[10px] py-[8px]">
                    <span className="text-[11px] font-medium text-[#A09E98] min-w-[38px]">{item.time}</span>
                    <div className="w-[6px] h-[6px] rounded-full bg-[#0F6E56] shrink-0" />
                    <p className="text-[12px] text-[#0F1A2E] flex-1 truncate">{item.patientName}</p>
                    <span className="text-[10px] px-[8px] py-[2px] rounded-full bg-[#F4F3EF] text-[#A09E98]">Pendente</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-[8px]">
                <p className="text-[12px] text-[#A09E98]">Nenhuma sessão hoje.</p>
                <Link href="/schedule/new" className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] hover:underline mt-[8px]">
                  + Criar sessão
                </Link>
              </div>
            )}
          </div>

          {/* Alertas de pacotes */}
          {alerts.packageAlerts.length > 0 && (
            <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
              <div className="flex items-center gap-[6px] mb-[12px]">
                <div className="w-5 h-5 rounded-[5px] bg-amber-50 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <p className="text-[12px] font-medium text-[#0F1A2E]">Pacotes encerrando</p>
                <span className="ml-auto text-[10px] font-medium bg-amber-50 text-amber-600 rounded-full px-[7px] py-[1px]">{alerts.packageAlerts.length}</span>
              </div>
              <div className="space-y-[6px]">
                {alerts.packageAlerts.map((pkg) => (
                  <Link
                    key={pkg.patientId + pkg.packageName}
                    href={`/patients/${pkg.patientId}`}
                    className="flex items-center justify-between rounded-[8px] bg-amber-50 px-[12px] py-[9px] hover:bg-amber-100 transition group"
                  >
                    <div>
                      <p className="text-[12px] font-medium text-[#0F1A2E]">{pkg.patientName}</p>
                      <p className="text-[10px] text-amber-600 mt-[1px]">{pkg.packageName}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[14px] font-semibold ${pkg.remaining <= 0 ? "text-red-500" : "text-amber-500"}`}>
                        {pkg.remaining <= 0 ? "Esgotado" : `${pkg.remaining} restante${pkg.remaining !== 1 ? "s" : ""}`}
                      </p>
                      <p className="text-[10px] text-[#A09E98]">{pkg.sessionsUsed}/{pkg.sessionsTotal} sessões</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Insights pendentes */}
          {pendingReviews > 0 && (
            <div className="bg-[#F0FAF6] border border-[#9FE1CB] rounded-[12px] p-[15px]">
              <div className="flex items-center gap-[6px] mb-[8px]">
                <svg className="w-[14px] h-[14px] text-[#0F6E56]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                <p className="text-[11px] font-medium text-[#0F6E56] tracking-[.06em] uppercase">Insights aguardando revisão</p>
              </div>
              <p className="text-[12px] text-[#085041]">
                {pendingReviews} insight{pendingReviews > 1 ? "s" : ""} gerado{pendingReviews > 1 ? "s" : ""} pela IA aguardam sua validação.
              </p>
              <Link href="/actions" className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] hover:underline mt-[10px]">
                Revisar agora →
              </Link>
            </div>
          )}

        </div>

        {/* Coluna direita */}
        <div className="space-y-[12px]">

          {/* Biomarcadores fora do padrão */}
          {alerts.biomarkerAlerts.length > 0 && (
            <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
              <div className="flex items-center gap-[6px] mb-[12px]">
                <div className="w-5 h-5 rounded-[5px] bg-red-50 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                </div>
                <p className="text-[12px] font-medium text-[#0F1A2E]">Biomarcadores alterados</p>
                <span className="ml-auto text-[10px] font-medium bg-red-50 text-red-500 rounded-full px-[7px] py-[1px]">{alerts.biomarkerAlerts.length}</span>
              </div>
              <div className="space-y-[4px]">
                {alerts.biomarkerAlerts.map((alert, i) => (
                  <Link
                    key={i}
                    href={`/patients/${alert.patientId}/evolution`}
                    className="flex items-center justify-between rounded-[8px] px-[10px] py-[8px] hover:bg-[#FAFAF8] transition group"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{alert.patientName}</p>
                      <p className="text-[11px] text-[#A09E98]">{alert.biomarker}</p>
                    </div>
                    <div className="flex items-center gap-[6px] shrink-0">
                      <span className="text-[11px] font-medium text-[#0F1A2E]">
                        {alert.value} {alert.unit ?? ""}
                      </span>
                      <span className={`text-[10px] font-medium px-[7px] py-[2px] rounded-full ${
                        alert.status === "high" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"
                      }`}>
                        {alert.status === "high" ? "Alto" : "Baixo"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Atalhos rápidos */}
          <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
            <p className="text-[12px] font-medium text-[#0F1A2E] mb-[10px]">Ações rápidas</p>
            <div className="space-y-[6px]">
              {[
                { label: "Novo paciente", href: "/patients/new", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" },
                { label: "Agendar sessão", href: "/schedule/new", icon: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
                { label: "Ver pacientes", href: "/patients", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
                { label: "Pipeline de leads", href: "/leads", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-[10px] rounded-[8px] px-[10px] py-[9px] hover:bg-[#F4F3EF] transition group"
                >
                  <div className="w-7 h-7 rounded-[7px] bg-[#F4F3EF] group-hover:bg-[#E1F5EE] flex items-center justify-center shrink-0 transition">
                    <svg className="w-3.5 h-3.5 text-[#6B6A66] group-hover:text-[#0F6E56] transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={action.icon} />
                    </svg>
                  </div>
                  <span className="text-[12px] text-[#0F1A2E]">{action.label}</span>
                  <svg className="w-3 h-3 text-[#D3D1C7] ml-auto group-hover:text-[#A09E98] transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </Link>
              ))}
            </div>
          </div>

          {/* Resumo da semana */}
          <div className="bg-[#0F1A2E] rounded-[12px] p-[15px]">
            <p className="text-[10px] font-medium text-white/40 tracking-[.08em] uppercase mb-[10px]">Resumo da semana</p>
            <div className="space-y-[8px]">
              {[
                { label: "Sessões realizadas", value: appointments.filter(a => new Date(a.starts_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length },
                { label: "Pacientes ativos", value: patients.filter(p => p.status === "active").length },
                { label: "Novos leads", value: newLeadsCount },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <p className="text-[12px] text-white/60">{item.label}</p>
                  <p className="text-[14px] font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </Shell>
  );
}
