import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, MessageCircle, BarChart3, Users, Bot, Smartphone, Star, Check, ChevronDown } from "lucide-react";

// ── SEO ───────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "AXIEL Core — Gestão clínica com IA para saúde integrativa",
  description:
    "Agenda, prontuário, WhatsApp automático, portal do paciente e insights de IA — tudo integrado para fisioterapeutas, psicólogos, nutricionistas e clínicas de wellness. 14 dias grátis.",
  openGraph: {
    title: "AXIEL Core — Gestão clínica com IA",
    description: "Tudo que sua clínica precisa em um só lugar. 14 dias grátis, sem cartão de crédito.",
    type: "website",
    locale: "pt_BR",
    siteName: "AXIEL Core",
  },
  twitter: {
    card: "summary_large_image",
    title: "AXIEL Core — Gestão clínica com IA",
    description: "Agenda, prontuário e automações para clínicas integrativas.",
  },
  keywords: [
    "sistema para clínica", "gestão clínica", "prontuário eletrônico",
    "agenda online", "fisioterapia", "psicologia", "nutrição", "saúde integrativa",
    "automação whatsapp clínica", "software clínica integrativa",
  ],
};

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: CalendarDays,
    title: "Agenda sem complicação",
    text: "Crie sessões em segundos. Lembretes automáticos via WhatsApp no dia anterior — zero faltas, zero ligações manuais.",
  },
  {
    icon: Users,
    title: "Prontuário completo",
    text: "Histórico, evolução, anamnese, exames e insights em uma única tela. Menos tempo de busca, mais tempo de atendimento.",
  },
  {
    icon: Bot,
    title: "IA que trabalha por você",
    text: "Insights clínicos gerados automaticamente após cada sessão. Sugestões de próximo passo para cada paciente.",
  },
  {
    icon: MessageCircle,
    title: "Automações de relacionamento",
    text: "WhatsApp e email automáticos: confirmação, lembrete D-1, acompanhamento D+3 e reativação D+30.",
  },
  {
    icon: Smartphone,
    title: "Portal do paciente",
    text: "Link personalizado para o paciente acompanhar sessões, evolução e pacote de tratamento.",
  },
  {
    icon: BarChart3,
    title: "Métricas que importam",
    text: "Receita do mês, taxa de retorno, pacotes encerrando e alertas de biomarcadores direto no dashboard.",
  },
];

const STEPS = [
  { n: "01", title: "Crie sua conta", text: "Configure a clínica em minutos: nome, tipos de sessão, horários de atendimento e link de agendamento." },
  { n: "02", title: "Cadastre seus pacientes", text: "Importe ou cadastre manualmente. O sistema envia boas-vindas automáticas e cria o portal de cada paciente." },
  { n: "03", title: "Deixe o sistema trabalhar", text: "Lembretes, acompanhamentos, relatórios e insights acontecem automaticamente. Você só cuida dos pacientes." },
];

const PLANS = [
  {
    name: "Starter",
    price: "R$78",
    period: "/mês",
    description: "Para clínicas que estão começando a se organizar.",
    features: ["Até 250 pacientes", "3 usuários", "Agenda e prontuário", "Automações WhatsApp", "10 formulários", "Portal do paciente básico"],
    cta: "Começar agora",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "R$118",
    period: "/mês",
    description: "Para clínicas que querem o fluxo completo.",
    features: ["Até 2.500 pacientes", "10 usuários", "Tudo do Starter", "Insights de IA", "Pacotes de tratamento", "Agendamento online", "Cobrança integrada (Stripe)", "Portal completo com identidade visual"],
    cta: "Começar agora",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para redes e grupos com múltiplas unidades.",
    features: ["Pacientes ilimitados", "Usuários ilimitados", "Multi-clínica", "Permissões avançadas", "Onboarding dedicado", "Suporte prioritário"],
    cta: "Falar com a equipe",
    highlighted: false,
  },
];

const SPECIALTIES = [
  "Fisioterapia", "Psicologia", "Nutrição", "Pilates Clínico",
  "Osteopatia", "Acupuntura", "Wellness Center", "Clínica Integrativa",
];

const TESTIMONIALS = [
  {
    quote: "Antes eu usava três ferramentas diferentes — agenda, prontuário e WhatsApp manual. Com o AXIEL, tudo ficou em um lugar só. Minha taxa de faltas caiu 40% com os lembretes automáticos.",
    name: "Dra. Fernanda Lopes",
    role: "Fisioterapeuta · São Paulo, SP",
    initials: "FL",
    color: "#E1F5EE",
    textColor: "#085041",
  },
  {
    quote: "O portal do paciente foi um diferencial enorme. Meus pacientes conseguem ver a evolução deles, o histórico de sessões e o pacote — isso gera engajamento e fidelidade que eu não tinha antes.",
    name: "Dr. Rodrigo Menezes",
    role: "Médico Integrativo · Florianópolis, SC",
    initials: "RM",
    color: "#EEF2FF",
    textColor: "#3730A3",
  },
  {
    quote: "A IA que gera insights clínicos após cada sessão me economiza uns 20 minutos de documentação por dia. Parece pouco, mas são mais de 7 horas por mês — que eu uso para atender mais pacientes.",
    name: "Camila Soares",
    role: "Nutricionista Funcional · Curitiba, PR",
    initials: "CS",
    color: "#FFF7ED",
    textColor: "#92400E",
  },
  {
    quote: "Migrei de uma planilha para o AXIEL em um único dia. O onboarding é realmente simples. Em 30 minutos já tinha meus pacientes cadastrados e a agenda configurada.",
    name: "Paulo Henrique Costa",
    role: "Osteopata · Belo Horizonte, MG",
    initials: "PC",
    color: "#F0FDF4",
    textColor: "#065F46",
  },
  {
    quote: "O módulo financeiro resolveu minha dor crônica: saber exatamente quem pagou, quem deve e qual foi a receita do mês. Sem planilha, sem chute.",
    name: "Dra. Aline Barbosa",
    role: "Psicóloga · Rio de Janeiro, RJ",
    initials: "AB",
    color: "#FDF4FF",
    textColor: "#6B21A8",
  },
  {
    quote: "Meus pacientes adoram receber o lembrete pelo WhatsApp no dia anterior. Parece simples, mas o feedback deles é que isso passa uma imagem muito profissional da clínica.",
    name: "Marcos Vieira",
    role: "Acupunturista · Porto Alegre, RS",
    initials: "MV",
    color: "#FFF1F2",
    textColor: "#9F1239",
  },
];

const FAQ = [
  {
    q: "Preciso de cartão de crédito para começar?",
    a: "Não. O período de teste de 14 dias é completamente grátis e não requer cartão de crédito. Você só paga se decidir continuar após o período de teste.",
  },
  {
    q: "Posso migrar meus pacientes de outro sistema?",
    a: "Sim. O AXIEL aceita importação via planilha (CSV/Excel) com nome, email, telefone e data de nascimento. Em minutos seus pacientes estão cadastrados.",
  },
  {
    q: "O WhatsApp automático exige alguma conta business?",
    a: "Sim, utilizamos a API oficial do WhatsApp Business (Meta). Ajudamos você a configurar durante o onboarding — é simples e a maioria das clínicas ativa em menos de uma hora.",
  },
  {
    q: "Meus dados ficam seguros? Está de acordo com a LGPD?",
    a: "Sim. Todos os dados são armazenados em servidores criptografados. Aplicamos controles de acesso por clínica, isolamento de dados entre contas e seguimos as diretrizes da LGPD.",
  },
  {
    q: "Posso usar em vários dispositivos e computadores?",
    a: "Sim. O AXIEL é 100% web — funciona em qualquer navegador, computador, tablet ou celular. Sem instalação.",
  },
  {
    q: "E se eu precisar de ajuda ou tiver dúvidas?",
    a: "Oferecemos suporte via chat e email. No plano Professional e acima, o suporte tem resposta prioritária. Também temos base de conhecimento com vídeos e tutoriais.",
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim, sem multa e sem burocracia. Você cancela diretamente nas configurações da conta. Seus dados ficam disponíveis por 30 dias após o cancelamento para exportação.",
  },
  {
    q: "O sistema funciona para clínicas com vários profissionais?",
    a: "Sim. Você pode convidar toda a equipe, definir permissões por cargo (dono, gestor, profissional, recepcionista) e cada um vê apenas o que precisa.",
  },
];

const STATS = [
  { value: "500+", label: "clínicas ativas" },
  { value: "40%", label: "menos faltas com lembretes" },
  { value: "7h", label: "economizadas/mês com IA" },
  { value: "14 dias", label: "grátis para testar" },
];

const INTEGRATIONS = [
  { name: "WhatsApp Business", desc: "Lembretes e automações", bg: "#25D366", letter: "W" },
  { name: "Stripe", desc: "Cobranças e assinaturas", bg: "#635BFF", letter: "S" },
  { name: "Google Calendar", desc: "Sincronização de agenda", bg: "#EA4335", letter: "G" },
  { name: "Zoom", desc: "Teleconsultas integradas", bg: "#2D8CFF", letter: "Z" },
  { name: "OpenAI GPT-4o", desc: "Insights e análise clínica", bg: "#10A37F", letter: "AI" },
  { name: "Supabase", desc: "Dados seguros em tempo real", bg: "#3ECF8E", letter: "SB" },
];

// ── Dashboard mockup ───────────────────────────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Browser chrome */}
      <div className="rounded-2xl border border-black/[.1] bg-[#1C1C1E] shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#2C2C2E]">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 max-w-xs mx-auto">
            <div className="bg-[#3A3A3C] rounded-md px-3 py-1 text-center">
              <span className="text-[11px] text-white/40">app.axielcore.com/dashboard</span>
            </div>
          </div>
        </div>

        {/* App shell */}
        <div className="flex h-[440px] bg-[#F8F7F4]">
          {/* Sidebar */}
          <div className="w-[192px] shrink-0 bg-[#0F1A2E] flex flex-col py-4 px-3 gap-1">
            <div className="px-2 pb-4 mb-2 border-b border-white/[.08]">
              <span className="text-[11px] font-semibold tracking-[0.2em] text-white/90">AXIEL CORE</span>
            </div>
            {[
              { label: "Dashboard", active: true },
              { label: "Agenda" },
              { label: "Pacientes" },
              { label: "Formulários" },
              { label: "Financeiro" },
              { label: "Resultados" },
              { label: "Automações" },
            ].map((item) => (
              <div
                key={item.label}
                className={`px-3 py-2 rounded-lg text-[12px] font-medium ${
                  item.active ? "bg-white/[.12] text-white" : "text-white/45"
                }`}
              >
                {item.label}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-hidden p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[13px] font-semibold text-[#0F1A2E]">Bom dia, Dra. Fernanda 👋</p>
                <p className="text-[11px] text-[#A09E98]">Quinta, 29 maio 2026</p>
              </div>
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-[#E1F5EE] flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-[#0F6E56]">3</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-[#F4F3EF]" />
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Receita do mês", value: "R$12.480", sub: "+18% vs. anterior", color: "#0F6E56" },
                { label: "Sessões", value: "87", sub: "↑12 vs. mês passado", color: "#3B82F6" },
                { label: "Taxa de retorno", value: "76%", sub: "Meta: 70% ✓", color: "#8B5CF6" },
                { label: "Novos pacientes", value: "14", sub: "Este mês", color: "#F59E0B" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl p-3 border border-black/[.06]">
                  <p className="text-[9px] text-[#A09E98] mb-1">{kpi.label.toUpperCase()}</p>
                  <p className="text-[18px] font-semibold leading-none" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-[9px] text-[#A09E98] mt-1">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* Lower row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Next sessions */}
              <div className="bg-white rounded-xl p-4 border border-black/[.06]">
                <p className="text-[11px] font-semibold text-[#0F1A2E] mb-3">Próximas sessões</p>
                {[
                  { time: "09:00", name: "Ana Costa", type: "Fisioterapia", dot: "#0F6E56" },
                  { time: "10:30", name: "João Lima", type: "Nutrição", dot: "#3B82F6" },
                  { time: "14:00", name: "Carla Souza", type: "Pilates Clínico", dot: "#8B5CF6" },
                ].map((s) => (
                  <div key={s.name} className="flex items-center gap-2 py-1.5 border-b border-black/[.04] last:border-0">
                    <span className="text-[10px] text-[#A09E98] w-10 shrink-0">{s.time}</span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
                    <span className="text-[11px] font-medium text-[#0F1A2E] flex-1 truncate">{s.name}</span>
                    <span className="text-[9px] text-[#A09E98]">{s.type}</span>
                  </div>
                ))}
              </div>

              {/* AI insight card */}
              <div className="bg-[#F0FAF6] rounded-xl p-4 border border-[#9FE1CB]">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px]">✦</span>
                  <p className="text-[10px] font-semibold text-[#0F6E56] tracking-[.04em] uppercase">Insight IA — Ana Costa</p>
                </div>
                <p className="text-[11px] text-[#085041] leading-relaxed line-clamp-3">
                  Progressão consistente nas últimas 4 semanas. Dor reduziu de 7/10 para 3/10. Recomendo avançar para protocolo de fase 2.
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="text-[10px] bg-[#0F6E56] text-white px-2 py-1 rounded-md">Aprovar</span>
                  <span className="text-[10px] bg-white text-[#0F6E56] border border-[#9FE1CB] px-2 py-1 rounded-md">Ver completo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute -bottom-4 -right-4 hidden md:flex items-center gap-2 bg-white border border-black/[.08] rounded-xl px-4 py-3 shadow-lg">
        <div className="w-8 h-8 rounded-full bg-[#E1F5EE] flex items-center justify-center text-base">✦</div>
        <div>
          <p className="text-[12px] font-semibold text-[#0F1A2E]">Insight gerado</p>
          <p className="text-[11px] text-[#A09E98]">Ana Costa · há 2min</p>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-4 hidden md:flex items-center gap-2 bg-white border border-black/[.08] rounded-xl px-4 py-3 shadow-lg">
        <div className="w-8 h-8 rounded-full bg-[#FFF8E7] flex items-center justify-center text-sm">📅</div>
        <div>
          <p className="text-[12px] font-semibold text-[#0F1A2E]">Sessão confirmada</p>
          <p className="text-[11px] text-[#A09E98]">WhatsApp enviado · agora</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0F1A2E]">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-black/[.06] bg-[#FAFAF8]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-[0.18em] text-[#0F1A2E]">AXIEL CORE</span>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#funcionalidades" className="text-sm text-black/55 hover:text-[#0F1A2E] transition">Funcionalidades</a>
            <a href="#como-funciona" className="text-sm text-black/55 hover:text-[#0F1A2E] transition">Como funciona</a>
            <a href="#depoimentos" className="text-sm text-black/55 hover:text-[#0F1A2E] transition">Depoimentos</a>
            <a href="#planos" className="text-sm text-black/55 hover:text-[#0F1A2E] transition">Planos</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-black/55 hover:text-[#0F1A2E] transition">Entrar</Link>
            <Link
              href="/onboarding"
              className="rounded-lg bg-[#0F1A2E] px-4 py-2 text-sm font-medium text-white hover:bg-black transition"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 md:pt-28">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0F6E56]/20 bg-[#E1F5EE] px-3 py-1.5">
            <Star className="h-3 w-3 text-[#0F6E56]" />
            <span className="text-xs font-medium text-[#0F6E56]">Sistema clínico com IA — feito para saúde integrativa</span>
          </div>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.03em] md:text-[64px]">
            Gestão clínica<br />
            <span className="text-[#0F6E56]">simples e inteligente.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-black/55">
            Agenda, prontuário, WhatsApp automático, portal do paciente e insights de IA — tudo integrado para fisioterapeutas, psicólogos, nutricionistas e clínicas de wellness.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F1A2E] px-6 py-3 text-sm font-medium text-white hover:bg-black transition"
            >
              Criar conta grátis <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 rounded-lg border border-black/15 bg-white px-6 py-3 text-sm font-medium text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
            >
              Ver como funciona
            </a>
          </div>
          <p className="mt-5 text-xs text-black/35">14 dias grátis · Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </section>

      {/* ── Product mockup ── */}
      <section className="mx-auto max-w-6xl px-6 pb-28 pt-4">
        <DashboardMockup />
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-black/[.06] bg-white py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-semibold tracking-tight text-[#0F1A2E]">{s.value}</p>
                <p className="mt-1 text-sm text-black/45">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Especialidades ── */}
      <section className="border-b border-black/[.06] bg-[#FAFAF8] py-5">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <span className="text-xs font-medium text-black/35 whitespace-nowrap">Usado por profissionais de:</span>
            {SPECIALTIES.map((s) => (
              <span key={s} className="text-sm font-medium text-black/55">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funcionalidades ── */}
      <section id="funcionalidades" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">Funcionalidades</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em]">Tudo que sua clínica precisa, em um só lugar.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-black/[.07] bg-white p-6 hover:border-black/15 transition">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#E1F5EE]">
                <f.icon className="h-5 w-5 text-[#0F6E56]" />
              </div>
              <h3 className="mb-2 text-base font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-black/55">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Integrações ── */}
      <section className="border-y border-black/[.06] bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">Integrações</p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em]">Conectado com as ferramentas que você já usa.</h2>
          </div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {INTEGRATIONS.map((int) => (
              <div key={int.name} className="flex flex-col items-center gap-3 rounded-2xl border border-black/[.07] bg-[#FAFAF8] p-5 text-center hover:border-black/15 transition">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-sm font-bold"
                  style={{ backgroundColor: int.bg }}
                >
                  {int.letter}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0F1A2E] leading-snug">{int.name}</p>
                  <p className="text-[11px] text-black/40 mt-0.5">{int.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section id="como-funciona" className="bg-[#0F1A2E] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 max-w-xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#9FE1CB]">Como funciona</p>
            <h2 className="text-4xl font-semibold tracking-[-0.025em] text-white">Pronto para usar em menos de um dia.</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n}>
                <span className="text-5xl font-semibold text-white/10">{step.n}</span>
                <h3 className="mt-3 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Automações destaque ── */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="rounded-3xl bg-[#E1F5EE] p-10 md:p-14">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">Automações</p>
              <h2 className="text-3xl font-semibold tracking-[-0.025em] text-[#0F1A2E] md:text-4xl">
                Seu paciente recebe a mensagem certa, na hora certa.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-black/55">
                Confirmação ao agendar, lembrete no dia anterior, acompanhamento 3 dias depois e reativação 30 dias após a última sessão — tudo automático via WhatsApp e email.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { label: "Confirmação imediata", desc: "Ao agendar — WhatsApp + email" },
                { label: "Lembrete D-1", desc: "24h antes da sessão" },
                { label: "Acompanhamento D+3", desc: "Como você está se sentindo?" },
                { label: "Reativação D+30", desc: "Sugere o próximo agendamento" },
                { label: "Pacote encerrando", desc: "Alerta quando restam ≤2 sessões" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-xl bg-white p-4">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F6E56]">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0F1A2E]">{item.label}</p>
                    <p className="text-xs text-black/50">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Depoimentos ── */}
      <section id="depoimentos" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">Depoimentos</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em]">Profissionais que transformaram sua clínica.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="flex flex-col rounded-2xl border border-black/[.07] bg-white p-6 hover:border-black/15 transition">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                ))}
              </div>
              <p className="flex-1 text-sm leading-relaxed text-black/65 mb-6">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                  style={{ backgroundColor: t.color, color: t.textColor }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0F1A2E]">{t.name}</p>
                  <p className="text-[11px] text-black/40">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Planos ── */}
      <section id="planos" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-14 max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">Planos</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em]">Simples. Sem surpresas.</h2>
          <p className="mt-3 text-base text-black/55">14 dias grátis em qualquer plano. Sem cartão de crédito para começar.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-7 flex flex-col ${
                plan.highlighted
                  ? "bg-[#0F1A2E] text-white"
                  : "border border-black/[.07] bg-white"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-[#0F6E56] px-3 py-1 text-[11px] font-semibold text-white">Mais popular</span>
                </div>
              )}
              <div className="mb-6">
                <h3 className={`text-lg font-semibold ${plan.highlighted ? "text-white" : "text-[#0F1A2E]"}`}>{plan.name}</h3>
                <p className={`mt-1 text-sm ${plan.highlighted ? "text-white/50" : "text-black/45"}`}>{plan.description}</p>
                <div className="mt-4 flex items-end gap-1">
                  <span className={`text-4xl font-semibold tracking-tight ${plan.highlighted ? "text-white" : "text-[#0F1A2E]"}`}>{plan.price}</span>
                  {plan.period && <span className={`mb-1 text-sm ${plan.highlighted ? "text-white/50" : "text-black/40"}`}>{plan.period}</span>}
                </div>
              </div>
              <ul className="mb-7 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <Check className={`h-4 w-4 shrink-0 ${plan.highlighted ? "text-[#9FE1CB]" : "text-[#0F6E56]"}`} />
                    <span className={`text-sm ${plan.highlighted ? "text-white/75" : "text-black/65"}`}>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.name === "Enterprise" ? "mailto:contato@axielcore.com" : "/onboarding"}
                className={`block rounded-lg px-5 py-3 text-center text-sm font-medium transition ${
                  plan.highlighted
                    ? "bg-white text-[#0F1A2E] hover:bg-[#F4F3EF]"
                    : "bg-[#0F1A2E] text-white hover:bg-black"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">Dúvidas frequentes</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em]">Respostas rápidas.</h2>
        </div>
        <div className="space-y-2">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-2xl border border-black/[.07] bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 select-none">
                <span className="text-[15px] font-medium text-[#0F1A2E] leading-snug">{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-black/35 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="px-6 pb-5">
                <p className="text-sm leading-relaxed text-black/55">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-black/40">
          Ainda tem dúvidas?{" "}
          <a href="mailto:contato@axielcore.com" className="text-[#0F6E56] hover:underline">
            Fale com a gente
          </a>
        </p>
      </section>

      {/* ── CTA Final ── */}
      <section className="border-t border-black/[.06] bg-white py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-4xl font-semibold tracking-[-0.025em]">Pronto para transformar sua clínica?</h2>
          <p className="mt-4 text-lg text-black/55">
            Comece hoje, sem compromisso. Configure tudo em menos de 30 minutos.
          </p>
          <Link
            href="/onboarding"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0F1A2E] px-8 py-4 text-base font-medium text-white hover:bg-black transition"
          >
            Criar conta grátis <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-sm text-black/35">14 dias grátis · Sem cartão de crédito</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-black/[.06] py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col items-center justify-between gap-6 md:flex-row">
          <span className="text-sm font-semibold tracking-[0.18em] text-[#0F1A2E]">AXIEL CORE</span>
          <p className="text-sm text-black/35">© 2026 AXIEL Core. Todos os direitos reservados.</p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/auth/login" className="text-sm text-black/45 hover:text-[#0F1A2E] transition">Entrar</Link>
            <a href="mailto:contato@axielcore.com" className="text-sm text-black/45 hover:text-[#0F1A2E] transition">Contato</a>
            <Link href="/privacidade" className="text-sm text-black/45 hover:text-[#0F1A2E] transition">Privacidade</Link>
            <Link href="/termos" className="text-sm text-black/45 hover:text-[#0F1A2E] transition">Termos de Uso</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
