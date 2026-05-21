import Link from "next/link";
import { ArrowRight, CalendarDays, MessageCircle, BarChart3, Users, Bot, Smartphone, Star, Check } from "lucide-react";

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
    text: "Link personalizado para o paciente acompanhar sessões, evolução e pacote de tratamento. Com a sua identidade visual.",
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
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-32">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0F6E56]/20 bg-[#E1F5EE] px-3 py-1.5">
            <Star className="h-3 w-3 text-[#0F6E56]" />
            <span className="text-xs font-medium text-[#0F6E56]">Sistema clínico com IA — feito para saúde integrativa</span>
          </div>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.03em] md:text-[68px]">
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

      {/* ── Especialidades ── */}
      <section className="border-y border-black/[.06] bg-white py-5">
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

      {/* ── Destaque ── */}
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
          <p className="text-sm text-black/35">© {new Date().getFullYear()} AXIEL Core. Todos os direitos reservados.</p>
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
