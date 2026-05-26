import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { ViewDetails } from "@/components/view-details";
import { BookingLinkCard } from "@/components/booking-link-card";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { canManageClinicUsers } from "@/modules/auth/roles";

const settings = [
  { href: "/settings/profile", title: "Meu perfil", text: "Atualize seu nome, email e senha de acesso." },
  { href: "/settings/equipe", title: "Equipe", text: "Convide profissionais, gerencie cargos e acesso à clínica." },
  { href: "/settings/practitioners", title: "Profissionais", text: "Perfil público, especialidade e agenda de cada profissional." },
  { href: "/settings/branding", title: "Identidade visual", text: "Logo e cor primária da sua clínica no portal e agendamento." },
  { href: "/settings/regional", title: "Regional", text: "Fuso horário e moeda padrão usados em toda a plataforma." },
  { href: "/clinics", title: "Configuração da clínica", text: "Perfil e configurações básicas da clínica." },
  { href: "/settings/integrations", title: "Integrações", text: "Google Calendar, Zoom e feed iCal para Apple Calendar." },
  { href: "/settings/session-types", title: "Tipos de sessão", text: "Modalidades, durações, preços e configuração de Zoom por tipo." },
  { href: "/settings/offers", title: "Ofertas e pacotes", text: "Crie pacotes de sessões e planos mensais visíveis no portal do paciente." },
  { href: "/settings/lembretes", title: "Lembretes automáticos", text: "Configure envio de lembretes de consulta por WhatsApp e e-mail." },
  { href: "/settings/whatsapp", title: "WhatsApp Bot", text: "Configure o assistente de IA: nome, programa, preços e idioma." },
  { href: "/settings/voice", title: "Ligações com IA", text: "IA atende ligações em português e inglês com voz neural. Mesmo persona do WhatsApp Bot." },
  { href: "/intake", title: "Formulários de intake", text: "Perguntas que pacientes respondem antes do atendimento." },
  { href: "/monetization", title: "Pacotes", text: "Pacotes de sessões e planos de adesão." },
  { href: "/follow-ups", title: "Acompanhamentos", text: "Lembretes manuais e mensagens de acompanhamento." },
  { href: "/get-started", title: "Checklist de configuração", text: "Fluxo de onboarding simplificado." },
  { href: "/billing", title: "Cobrança", text: "Assinatura, período de teste, upgrades e faturas." },
];

export default async function SettingsPage() {
  const [clinic, profile] = await Promise.all([
    getCurrentClinic(),
    getCurrentUserProfile(),
  ]);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const isAdmin = canManageClinicUsers(profile?.role);

  return (
    <Shell>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Configurações</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Ferramentas avançadas</h1>
        <p className="mt-3 text-lg text-black/55">Você raramente precisará acessar esta página no dia a dia.</p>
      </div>

      {clinic?.slug && (
        <BookingLinkCard slug={clinic.slug} baseUrl={baseUrl} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {settings.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="p-6 transition hover:-translate-y-0.5 hover:shadow-sm">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-black/55">{item.text}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <ViewDetails label="Ver todas">
          <div className="grid gap-4 md:grid-cols-2">
            {settings.slice(5).map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="p-6 transition hover:-translate-y-0.5 hover:shadow-sm">
                  <h2 className="text-xl font-semibold">{item.title}</h2>
                  <p className="mt-2 text-sm text-black/55">{item.text}</p>
                </Card>
              </Link>
            ))}

            {/* Admin-only: Audit log */}
            {isAdmin && (
              <Link href="/admin/audit">
                <Card className="p-6 transition hover:-translate-y-0.5 hover:shadow-sm border-[#0F6E56]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold">Log de Auditoria</h2>
                    <span className="text-[10px] font-medium text-[#0F6E56] bg-[#E1F5EE] px-[7px] py-[2px] rounded-full">Admin</span>
                  </div>
                  <p className="text-sm text-black/55">Histórico completo de ações do sistema e comunicações enviadas.</p>
                </Card>
              </Link>
            )}
          </div>
        </ViewDetails>
      </div>
    </Shell>
  );
}
