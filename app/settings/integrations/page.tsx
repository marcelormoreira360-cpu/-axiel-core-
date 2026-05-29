import Link from "next/link";
import { Shell } from "@/components/shell";
import { getCurrentUserProfile } from "@/services/user-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getGoogleIntegrationStatus } from "@/services/google-calendar-service";
import { getZoomIntegrationStatus } from "@/services/zoom-service";
import { getIcalSecret } from "@/services/ical-service";
import { IcalCopyButton } from "@/components/ical-copy-button";
import { ZoomCredentialsForm } from "@/components/zoom-credentials-form";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`text-[10px] font-medium px-[8px] py-[2px] rounded-full ${connected ? "bg-[#E1F5EE] text-[#0F6E56]" : "bg-[#F4F3EF] dark:bg-white/[.06] text-[#A09E98]"}`}>
      {connected ? "Conectado" : "Não conectado"}
    </span>
  );
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const [profile, clinic] = await Promise.all([getCurrentUserProfile(), getCurrentClinic()]);
  const clinicId = profile?.clinic_id ?? clinic?.id;
  if (!clinicId) redirect("/dashboard");

  const zoomStatus = getZoomIntegrationStatus();
  const supabase = await createSupabaseServerClient();
  const { data: clinicSettings } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const hasClinicZoomCreds = !!(clinicSettings?.settings as Record<string, unknown> | null)?.zoom;

  const [googleStatus, icalSecret] = await Promise.all([
    getGoogleIntegrationStatus(clinicId),
    getIcalSecret(clinicId),
  ]);

  const sp = await searchParams;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const icalUrl = icalSecret ? `${appUrl}/api/ical/${icalSecret}` : null;

  const toast = sp.success
    ? { type: "success", message:
        sp.success === "google"              ? "Google Calendar conectado com sucesso!" :
        sp.success === "google_disconnected" ? "Google Calendar desconectado." :
        sp.success === "zoom"                ? "Zoom conectado com sucesso!" :
        sp.success === "zoom_disconnected"   ? "Zoom desconectado." : "" }
    : sp.error
    ? { type: "error", message:
        sp.error === "google_denied" ? "Autorização do Google Calendar cancelada." :
        sp.error === "zoom_denied"   ? "Autorização do Zoom cancelada." :
        "Erro ao conectar. Tente novamente." }
    : null;

  return (
    <Shell>
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-[4px]">Configurações</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">
          Integrações
        </h1>
        <p className="text-[13px] text-[#A09E98] mt-[3px]">
          Sincronize consultas com seu calendário e videoconferência.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-[14px] py-[10px] rounded-[10px] mb-5 text-[13px] ${toast.type === "success" ? "bg-[#E1F5EE] text-[#0F6E56] border border-[#9FE1CB]" : "bg-[#FEECEC] text-[#DC2626] border border-[#FCA5A5]"}`}>
          {toast.type === "success"
            ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          {toast.message}
        </div>
      )}

      <div className="space-y-4">

        {/* ── Google Calendar ── */}
        <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[14px] p-[20px]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Google icon */}
              <div className="w-10 h-10 rounded-[10px] border border-black/[.07] dark:border-white/[.08] flex items-center justify-center bg-white dark:bg-[#1C2333] shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">Google Calendar</p>
                <p className="text-[12px] text-[#A09E98] mt-[1px]">Sincroniza consultas automaticamente como eventos.</p>
              </div>
            </div>
            <StatusBadge connected={googleStatus.connected} />
          </div>

          {googleStatus.connected && (
            <div className="mt-3 flex items-center gap-2 bg-[#F4F3EF] dark:bg-white/[.04] rounded-[8px] px-[12px] py-[8px]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="2" stroke="#0F6E56" strokeWidth="1.2"/><path d="M1 5h10" stroke="#0F6E56" strokeWidth="1.2"/><path d="M4 1v4M8 1v4" stroke="#0F6E56" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <span className="text-[12px] text-[#6B6A66] dark:text-[#9E9C97]">
                Calendário: <strong className="text-[#0F1A2E] dark:text-[#E8E6E2]">{googleStatus.calendar_id ?? "primary"}</strong>
              </span>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {!googleStatus.connected ? (
              <a
                href="/api/integrations/google"
                className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F1A2E] dark:bg-white/[.10] hover:bg-[#1C2B45] dark:hover:bg-white/[.15] transition px-[14px] py-[8px] rounded-[8px]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="white"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white"/></svg>
                Conectar Google Calendar
              </a>
            ) : (
              <form action="/api/integrations/google/disconnect" method="POST">
                <button type="submit" className="text-[12px] font-medium text-[#DC2626] border border-[#DC2626]/20 hover:bg-[#DC2626]/[.06] transition px-[14px] py-[8px] rounded-[8px]">
                  Desconectar
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── Zoom ── */}
        <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[14px] p-[20px]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] border border-black/[.07] dark:border-white/[.08] flex items-center justify-center bg-[#2D8CFF]/[.08] shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4" fill="#2D8CFF"/>
                  <path d="M4 8.5a2 2 0 012-2h7a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7z" fill="white"/>
                  <path d="M15 10.5l4-2v7l-4-2v-3z" fill="white"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">Zoom</p>
                <p className="text-[12px] text-[#A09E98] mt-[1px]">Cria reunião Zoom automaticamente ao agendar consulta.</p>
              </div>
            </div>
            <StatusBadge connected={zoomStatus.connected} />
          </div>

          {zoomStatus.connected ? (
            <div className="mt-3 flex items-center gap-2 bg-[#F4F3EF] dark:bg-white/[.04] rounded-[8px] px-[12px] py-[8px]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l2.5 2.5L10 3" stroke="#0F6E56" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[12px] text-[#6B6A66] dark:text-[#9E9C97]">
                Configurado via variáveis de ambiente — reuniões criadas automaticamente para sessões online.
              </span>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 bg-[#FFF8E1] dark:bg-yellow-500/[.08] rounded-[8px] px-[12px] py-[8px]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L1 10h10L6 1z" stroke="#D97706" strokeWidth="1.2" strokeLinejoin="round"/><path d="M6 5v2.5M6 9v.5" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round"/></svg>
              <span className="text-[12px] text-[#92400E] dark:text-yellow-400">
                Configure <code className="bg-white dark:bg-[#1C2333] px-1 rounded text-[11px]">ZOOM_ACCOUNT_ID</code>, <code className="bg-white dark:bg-[#1C2333] px-1 rounded text-[11px]">ZOOM_CLIENT_ID</code> e <code className="bg-white dark:bg-[#1C2333] px-1 rounded text-[11px]">ZOOM_CLIENT_SECRET</code> no Vercel.
              </span>
            </div>
          )}

          <ZoomCredentialsForm hasClinicCreds={hasClinicZoomCreds} />
        </div>

        {/* ── iCal / Apple Calendar ── */}
        <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[14px] p-[20px]">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] border border-black/[.07] dark:border-white/[.08] flex items-center justify-center shrink-0 bg-gradient-to-br from-[#F55] to-[#E33]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="18" rx="3" fill="white"/>
                  <path d="M3 9h18" stroke="#E33" strokeWidth="1.5"/>
                  <path d="M8 2v4M16 2v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M7 13h2v2H7zM11 13h2v2h-2zM15 13h2v2h-2zM7 17h2v2H7zM11 17h2v2h-2z" fill="#E33"/>
                </svg>
              </div>
              <div>
                <p className="text-[14px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">Apple Calendar / iCal</p>
                <p className="text-[12px] text-[#A09E98] mt-[1px]">Feed .ics subscritível — funciona em qualquer app de calendário.</p>
              </div>
            </div>
            <span className="text-[10px] font-medium px-[8px] py-[2px] rounded-full bg-[#E1F5EE] text-[#0F6E56]">
              Sempre ativo
            </span>
          </div>

          {icalUrl && (
            <>
              <IcalCopyButton url={icalUrl} />
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <a
                  href={`webcal://${icalUrl.replace(/^https?:\/\//, "")}`}
                  className="flex items-center justify-center gap-2 text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.05] transition px-4 py-2.5 rounded-[8px]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Abrir no Apple Calendar
                </a>
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icalUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.05] transition px-4 py-2.5 rounded-[8px]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Adicionar ao Google Calendar
                </a>
                <a
                  href={icalUrl}
                  download
                  className="flex items-center justify-center gap-2 text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.05] transition px-4 py-2.5 rounded-[8px]"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Baixar .ics
                </a>
              </div>
            </>
          )}
        </div>

        {/* ── NFS-e ── */}
        <Link href="/settings/integrations/nfse">
          <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[14px] p-[20px] hover:border-black/15 transition cursor-pointer">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] border border-black/[.07] flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #1a6b3a 0%, #0F6E56 100%)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M14 2v6h6M8 13h8M8 17h5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">NFS-e · NFe.io</p>
                  <p className="text-[12px] text-[#A09E98] mt-[1px]">Emita notas fiscais de serviço diretamente pelo AXIEL.</p>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black/30 mt-1 shrink-0"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </div>
        </Link>

        {/* ── Hotmart ── */}
        <Link href="/settings/integrations/hotmart">
          <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[14px] p-[20px] hover:border-black/15 transition cursor-pointer">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] border border-black/[.07] flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #FF4D2E 0%, #FF6B35 100%)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z" fill="white" opacity="0.6"/>
                    <path d="M12 7v5l3.5 3.5-1.5 1.5L10 13.5V7h2z" fill="white"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">Hotmart</p>
                  <p className="text-[12px] text-[#A09E98] mt-[1px]">Sincroniza compras de cursos e infoprodutos com pacientes da clínica.</p>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-black/30 mt-1 shrink-0"><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </div>
        </Link>

        {/* Setup instructions */}
        <div className="bg-[#F4F3EF] dark:bg-white/[.03] border border-black/[.06] dark:border-white/[.06] rounded-[12px] p-[16px]">
          <p className="text-[12px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2] mb-[8px]">
            Configuração necessária (Google Calendar e Zoom)
          </p>
          <div className="space-y-[6px] text-[12px] text-[#6B6A66] dark:text-[#9E9C97]">
            <p><strong className="text-[#0F1A2E] dark:text-[#E8E6E2]">Google Calendar:</strong> Crie um projeto em <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] hover:underline">console.cloud.google.com</a> → Ative a Google Calendar API → Credenciais OAuth2 → adicione <code className="bg-white dark:bg-[#1C2333] px-1 rounded text-[11px]">{process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback</code> como redirect URI → salve <code className="bg-white dark:bg-[#1C2333] px-1 rounded text-[11px]">GOOGLE_CLIENT_ID</code> e <code className="bg-white dark:bg-[#1C2333] px-1 rounded text-[11px]">GOOGLE_CLIENT_SECRET</code> no Vercel.</p>
            <p><strong className="text-[#0F1A2E] dark:text-[#E8E6E2]">Zoom:</strong> Crie um app OAuth em <a href="https://marketplace.zoom.us/develop/create" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] hover:underline">marketplace.zoom.us</a> → OAuth app → Redirect URL: <code className="bg-white dark:bg-[#1C2333] px-1 rounded text-[11px]">{process.env.NEXT_PUBLIC_APP_URL}/api/integrations/zoom/callback</code> → salve <code className="bg-white dark:bg-[#1C2333] px-1 rounded text-[11px]">ZOOM_CLIENT_ID</code> e <code className="bg-white dark:bg-[#1C2333] px-1 rounded text-[11px]">ZOOM_CLIENT_SECRET</code> no Vercel.</p>
          </div>
        </div>

      </div>
    </Shell>
  );
}
