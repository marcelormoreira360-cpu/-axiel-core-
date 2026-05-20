import Link from "next/link";
import { type PatientPortalData } from "@/services/patient-portal-service";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function shortText(value: string | null | undefined, max = 180) {
  const clean = value?.trim();
  if (!clean) return "Sua clínica adicionará uma atualização em breve.";
  return clean.length > max ? `${clean.slice(0, max - 3)}…` : clean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{title}</p>
      {children}
    </div>
  );
}

export function PatientPortalDashboard({ data }: { data: PatientPortalData }) {
  const firstName = data.patient.full_name.split(" ")[0];
  const nextSession = data.upcomingAppointments[0];
  const pkg = data.activePackage;
  const pkgPercent = pkg ? Math.round((pkg.sessions_used / pkg.sessions_total) * 100) : 0;
  const brandColor = data.clinic.primary_color ?? "#0B1F3A";

  return (
    <div className="min-h-screen bg-[#F8FAF9] px-4 py-8 md:py-12">
      <div className="mx-auto w-full max-w-md space-y-4">

        {/* Header */}
        <div className="pb-2">
          {data.clinic.logo_url ? (
            <img
              src={data.clinic.logo_url}
              alt={data.clinic.name}
              className="mb-3 h-8 max-w-[140px] object-contain"
            />
          ) : (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/35">{data.clinic.name}</p>
          )}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0F1A2E]">
            Olá, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-black/50">Acompanhe seu progresso e suas sessões.</p>
        </div>

        {/* Próxima sessão */}
        {nextSession ? (
          <div className="rounded-2xl p-5 text-white" style={{ backgroundColor: brandColor }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50 mb-2">Próxima sessão</p>
            <p className="text-lg font-semibold">{formatDateTime(nextSession.starts_at)}</p>
            {nextSession.duration_minutes && (
              <p className="text-sm text-white/60 mt-1">{nextSession.duration_minutes} minutos</p>
            )}
            {data.whatsappUrl && (
              <Link
                href={data.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-xs font-medium text-white/70 hover:text-white underline underline-offset-2 transition"
              >
                Solicitar reagendamento via WhatsApp →
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-black/[.07] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40 mb-2">Próxima sessão</p>
            <p className="text-sm text-black/50">Nenhuma sessão agendada no momento.</p>
            {data.whatsappUrl && (
              <Link
                href={data.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium text-[#0F6E56] hover:underline"
              >
                Agendar pelo WhatsApp →
              </Link>
            )}
          </div>
        )}

        {/* Pacote ativo */}
        {pkg && (
          <Section title="Seu pacote">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-[#0F1A2E]">{pkg.name}</p>
                <p className="text-sm font-medium text-[#0F6E56]">
                  {pkg.sessions_remaining} sessão(ões) restante(s)
                </p>
              </div>
              <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0F6E56] rounded-full transition-all"
                  style={{ width: `${pkgPercent}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-black/40">
                {pkg.sessions_used} de {pkg.sessions_total} sessões utilizadas
              </p>
            </div>
          </Section>
        )}

        {/* Insight */}
        {data.latestInsight && (
          <Section title="Seu progresso">
            <div>
              <p className="text-base font-semibold text-[#0F1A2E]">{data.latestInsight.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-black/60">
                {shortText(data.latestInsight.summary, 200)}
              </p>
            </div>
            <div className="bg-[#F0FAF5] rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0F6E56]/70 mb-1">Próximo passo</p>
              <p className="text-sm leading-relaxed text-[#0F1A2E]">
                {shortText(data.nextStep, 160)}
              </p>
            </div>
          </Section>
        )}

        {/* Histórico de sessões */}
        {data.sessions.length > 0 && (
          <Section title="Histórico de sessões">
            <div className="space-y-2">
              {data.sessions.slice(0, 5).map((session, index) => (
                <div
                  key={session.id ?? index}
                  className="flex items-center justify-between py-2 border-b border-black/[.05] last:border-0"
                >
                  <span className="text-sm text-black/70">Sessão {data.sessions.length - index}</span>
                  <span className="text-sm text-black/50">{formatDate(session.starts_at)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Próximas sessões (list) */}
        {data.upcomingAppointments.length > 1 && (
          <Section title="Agendamentos futuros">
            <div className="space-y-2">
              {data.upcomingAppointments.map((appt, index) => (
                <div
                  key={appt.id ?? index}
                  className="flex items-center justify-between py-2 border-b border-black/[.05] last:border-0"
                >
                  <span className="text-sm text-[#0F1A2E]">{formatDateTime(appt.starts_at)}</span>
                  {appt.duration_minutes && (
                    <span className="text-xs text-black/40">{appt.duration_minutes} min</span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* WhatsApp CTA */}
        {data.whatsappUrl && (
          <Link
            href={data.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-2xl bg-[#25D366] text-white text-center py-3.5 text-sm font-semibold hover:bg-[#22c55e] transition"
          >
            Falar com sua clínica pelo WhatsApp
          </Link>
        )}

        <p className="pb-4 text-center text-xs text-black/30">
          Esta página é privada. Não compartilhe este link.
        </p>
      </div>
    </div>
  );
}
