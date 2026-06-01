import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
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

const FEATURE_ICONS = [CalendarDays, Users, Bot, MessageCircle, Smartphone, BarChart3];
const INTEGRATION_META = [
  { name: "WhatsApp Business", descKey: "whatsappDesc", bg: "#25D366", letter: "W" },
  { name: "Stripe", descKey: "stripeDesc", bg: "#635BFF", letter: "S" },
  { name: "Google Calendar", descKey: "googleDesc", bg: "#EA4335", letter: "G" },
  { name: "Zoom", descKey: "zoomDesc", bg: "#2D8CFF", letter: "Z" },
  { name: "OpenAI GPT-4o", descKey: "openaiDesc", bg: "#10A37F", letter: "AI" },
  { name: "Supabase", descKey: "supabaseDesc", bg: "#3ECF8E", letter: "SB" },
];
const TESTIMONIAL_META = [
  { name: "Dra. Fernanda Lopes", initials: "FL", color: "#E1F5EE", textColor: "#085041" },
  { name: "Dr. Rodrigo Menezes", initials: "RM", color: "#EEF2FF", textColor: "#3730A3" },
  { name: "Camila Soares", initials: "CS", color: "#FFF7ED", textColor: "#92400E" },
  { name: "Paulo Henrique Costa", initials: "PC", color: "#F0FDF4", textColor: "#065F46" },
  { name: "Dra. Aline Barbosa", initials: "AB", color: "#FDF4FF", textColor: "#6B21A8" },
  { name: "Marcos Vieira", initials: "MV", color: "#FFF1F2", textColor: "#9F1239" },
];

// ── Dashboard mockup ───────────────────────────────────────────────────────────
async function DashboardMockup() {
  const t = await getTranslations("landing.mockup");
  const navItems = [
    { label: t("navDashboard"), active: true },
    { label: t("navSchedule") },
    { label: t("navPatients") },
    { label: t("navForms") },
    { label: t("navFinance") },
    { label: t("navResults") },
    { label: t("navAutomations") },
  ];
  const kpis = [
    { label: t("kpiRevenue"), value: "R$12.480", sub: t("kpiRevenueSub"), color: "#0F6E56" },
    { label: t("kpiSessions"), value: "87", sub: t("kpiSessionsSub"), color: "#3B82F6" },
    { label: t("kpiReturn"), value: "76%", sub: t("kpiReturnSub"), color: "#8B5CF6" },
    { label: t("kpiNew"), value: "14", sub: t("kpiNewSub"), color: "#F59E0B" },
  ];
  const sessions = [
    { time: "09:00", name: "Ana Costa", type: t("typePhysio"), dot: "#0F6E56" },
    { time: "10:30", name: "João Lima", type: t("typeNutrition"), dot: "#3B82F6" },
    { time: "14:00", name: "Carla Souza", type: t("typePilates"), dot: "#8B5CF6" },
  ];
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
              <span className="text-[11px] text-white/40">{t("url")}</span>
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
            {navItems.map((item) => (
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
                <p className="text-[13px] font-semibold text-[#0F1A2E]">{t("greeting")}</p>
                <p className="text-[11px] text-[#A09E98]">{t("date")}</p>
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
              {kpis.map((kpi) => (
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
                <p className="text-[11px] font-semibold text-[#0F1A2E] mb-3">{t("nextSessions")}</p>
                {sessions.map((s) => (
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
                  <p className="text-[10px] font-semibold text-[#0F6E56] tracking-[.04em] uppercase">{t("insightLabel")}</p>
                </div>
                <p className="text-[11px] text-[#085041] leading-relaxed line-clamp-3">
                  {t("insightText")}
                </p>
                <div className="mt-3 flex gap-2">
                  <span className="text-[10px] bg-[#0F6E56] text-white px-2 py-1 rounded-md">{t("approve")}</span>
                  <span className="text-[10px] bg-white text-[#0F6E56] border border-[#9FE1CB] px-2 py-1 rounded-md">{t("viewFull")}</span>
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
          <p className="text-[12px] font-semibold text-[#0F1A2E]">{t("badgeInsight")}</p>
          <p className="text-[11px] text-[#A09E98]">{t("badgeInsightSub")}</p>
        </div>
      </div>
      <div className="absolute -bottom-4 -left-4 hidden md:flex items-center gap-2 bg-white border border-black/[.08] rounded-xl px-4 py-3 shadow-lg">
        <div className="w-8 h-8 rounded-full bg-[#FFF8E7] flex items-center justify-center text-sm">📅</div>
        <div>
          <p className="text-[12px] font-semibold text-[#0F1A2E]">{t("badgeConfirmed")}</p>
          <p className="text-[11px] text-[#A09E98]">{t("badgeConfirmedSub")}</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function LandingPage() {
  const t = await getTranslations("landing");

  const features = [
    { icon: FEATURE_ICONS[0], title: t("features.scheduleTitle"), text: t("features.scheduleText") },
    { icon: FEATURE_ICONS[1], title: t("features.recordsTitle"), text: t("features.recordsText") },
    { icon: FEATURE_ICONS[2], title: t("features.aiTitle"), text: t("features.aiText") },
    { icon: FEATURE_ICONS[3], title: t("features.automationTitle"), text: t("features.automationText") },
    { icon: FEATURE_ICONS[4], title: t("features.portalTitle"), text: t("features.portalText") },
    { icon: FEATURE_ICONS[5], title: t("features.metricsTitle"), text: t("features.metricsText") },
  ];
  const stats = [
    { value: "500+", label: t("stats.clinics") },
    { value: "40%", label: t("stats.lessNoShows") },
    { value: "7h", label: t("stats.savedPerMonth") },
    { value: t("stats.freeTrialValue"), label: t("stats.freeTrial") },
  ];
  const specialties = [
    t("specialties.physio"), t("specialties.psychology"), t("specialties.nutrition"), t("specialties.pilates"),
    t("specialties.osteopathy"), t("specialties.acupuncture"), t("specialties.wellness"), t("specialties.integrative"),
  ];
  const integrations = INTEGRATION_META.map((i) => ({ ...i, desc: t(`integrations.${i.descKey}`) }));
  const steps = [
    { n: "01", title: t("steps.step1Title"), text: t("steps.step1Text") },
    { n: "02", title: t("steps.step2Title"), text: t("steps.step2Text") },
    { n: "03", title: t("steps.step3Title"), text: t("steps.step3Text") },
  ];
  const automationItems = [
    { label: t("automations.confirmLabel"), desc: t("automations.confirmDesc") },
    { label: t("automations.d1Label"), desc: t("automations.d1Desc") },
    { label: t("automations.d3Label"), desc: t("automations.d3Desc") },
    { label: t("automations.d30Label"), desc: t("automations.d30Desc") },
    { label: t("automations.packageLabel"), desc: t("automations.packageDesc") },
  ];
  const testimonials = TESTIMONIAL_META.map((m, i) => ({
    ...m, quote: t(`testimonials.quote${i + 1}`), role: t(`testimonials.role${i + 1}`),
  }));
  const plans = [
    {
      name: "Starter", price: t("plans.starterPrice"), period: t("plans.perMonth"),
      description: t("plans.starterDesc"), cta: t("plans.ctaStart"), highlighted: false,
      features: [t("plans.starterF1"), t("plans.starterF2"), t("plans.starterF3"), t("plans.starterF4"), t("plans.starterF5"), t("plans.starterF6")],
    },
    {
      name: "Professional", price: t("plans.professionalPrice"), period: t("plans.perMonth"),
      description: t("plans.professionalDesc"), cta: t("plans.ctaStart"), highlighted: true,
      features: [t("plans.professionalF1"), t("plans.professionalF2"), t("plans.professionalF3"), t("plans.professionalF4"), t("plans.professionalF5"), t("plans.professionalF6"), t("plans.professionalF7"), t("plans.professionalF8")],
    },
    {
      name: "Enterprise", price: t("plans.enterprisePrice"), period: "",
      description: t("plans.enterpriseDesc"), cta: t("plans.ctaContact"), highlighted: false,
      features: [t("plans.enterpriseF1"), t("plans.enterpriseF2"), t("plans.enterpriseF3"), t("plans.enterpriseF4"), t("plans.enterpriseF5"), t("plans.enterpriseF6")],
    },
  ];
  const faq = Array.from({ length: 8 }, (_, i) => ({ q: t(`faq.q${i + 1}`), a: t(`faq.a${i + 1}`) }));

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0F1A2E]">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-black/[.06] bg-[#FAFAF8]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-sm font-semibold tracking-[0.18em] text-[#0F1A2E]">AXIEL CORE</span>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#funcionalidades" className="text-sm text-black/55 hover:text-[#0F1A2E] transition">{t("nav.features")}</a>
            <a href="#como-funciona" className="text-sm text-black/55 hover:text-[#0F1A2E] transition">{t("nav.howItWorks")}</a>
            <a href="#depoimentos" className="text-sm text-black/55 hover:text-[#0F1A2E] transition">{t("nav.testimonials")}</a>
            <a href="#planos" className="text-sm text-black/55 hover:text-[#0F1A2E] transition">{t("nav.plans")}</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-black/55 hover:text-[#0F1A2E] transition">{t("nav.login")}</Link>
            <Link
              href="/onboarding"
              className="rounded-lg bg-[#0F1A2E] px-4 py-2 text-sm font-medium text-white hover:bg-black transition"
            >
              {t("nav.startFree")}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 md:pt-28">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0F6E56]/20 bg-[#E1F5EE] px-3 py-1.5">
            <Star className="h-3 w-3 text-[#0F6E56]" />
            <span className="text-xs font-medium text-[#0F6E56]">{t("hero.badge")}</span>
          </div>
          <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.03em] md:text-[64px]">
            {t("hero.titleLine1")}<br />
            <span className="text-[#0F6E56]">{t("hero.titleLine2")}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-black/55">
            {t("hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F1A2E] px-6 py-3 text-sm font-medium text-white hover:bg-black transition"
            >
              {t("hero.ctaCreate")} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex items-center gap-2 rounded-lg border border-black/15 bg-white px-6 py-3 text-sm font-medium text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
            >
              {t("hero.ctaHow")}
            </a>
          </div>
          <p className="mt-5 text-xs text-black/35">{t("hero.trialNote")}</p>
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
            {stats.map((s) => (
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
            <span className="text-xs font-medium text-black/35 whitespace-nowrap">{t("specialties.usedBy")}</span>
            {specialties.map((s) => (
              <span key={s} className="text-sm font-medium text-black/55">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funcionalidades ── */}
      <section id="funcionalidades" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-14 max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">{t("features.eyebrow")}</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em]">{t("features.title")}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
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
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">{t("integrations.eyebrow")}</p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em]">{t("integrations.title")}</h2>
          </div>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {integrations.map((int) => (
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
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#9FE1CB]">{t("steps.eyebrow")}</p>
            <h2 className="text-4xl font-semibold tracking-[-0.025em] text-white">{t("steps.title")}</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
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
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">{t("automations.eyebrow")}</p>
              <h2 className="text-3xl font-semibold tracking-[-0.025em] text-[#0F1A2E] md:text-4xl">
                {t("automations.title")}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-black/55">
                {t("automations.subtitle")}
              </p>
            </div>
            <div className="space-y-3">
              {automationItems.map((item) => (
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">{t("testimonials.eyebrow")}</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em]">{t("testimonials.title")}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((tm) => (
            <div key={tm.name} className="flex flex-col rounded-2xl border border-black/[.07] bg-white p-6 hover:border-black/15 transition">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                ))}
              </div>
              <p className="flex-1 text-sm leading-relaxed text-black/65 mb-6">&ldquo;{tm.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                  style={{ backgroundColor: tm.color, color: tm.textColor }}
                >
                  {tm.initials}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[#0F1A2E]">{tm.name}</p>
                  <p className="text-[11px] text-black/40">{tm.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Planos ── */}
      <section id="planos" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-14 max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">{t("plans.eyebrow")}</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em]">{t("plans.title")}</h2>
          <p className="mt-3 text-base text-black/55">{t("plans.subtitle")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
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
                  <span className="rounded-full bg-[#0F6E56] px-3 py-1 text-[11px] font-semibold text-white">{t("plans.mostPopular")}</span>
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
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56]">{t("faq.eyebrow")}</p>
          <h2 className="text-4xl font-semibold tracking-[-0.025em]">{t("faq.title")}</h2>
        </div>
        <div className="space-y-2">
          {faq.map((item) => (
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
          {t("faq.stillQuestions")}{" "}
          <a href="mailto:contato@axielcore.com" className="text-[#0F6E56] hover:underline">
            {t("faq.talkToUs")}
          </a>
        </p>
      </section>

      {/* ── CTA Final ── */}
      <section className="border-t border-black/[.06] bg-white py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-4xl font-semibold tracking-[-0.025em]">{t("cta.title")}</h2>
          <p className="mt-4 text-lg text-black/55">
            {t("cta.subtitle")}
          </p>
          <Link
            href="/onboarding"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0F1A2E] px-8 py-4 text-base font-medium text-white hover:bg-black transition"
          >
            {t("cta.button")} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-sm text-black/35">{t("cta.trialNote")}</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-black/[.06] py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col items-center justify-between gap-6 md:flex-row">
          <span className="text-sm font-semibold tracking-[0.18em] text-[#0F1A2E]">AXIEL CORE</span>
          <p className="text-sm text-black/35">{t("footer.rights")}</p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/auth/login" className="text-sm text-black/45 hover:text-[#0F1A2E] transition">{t("footer.login")}</Link>
            <a href="mailto:contato@axielcore.com" className="text-sm text-black/45 hover:text-[#0F1A2E] transition">{t("footer.contact")}</a>
            <Link href="/privacidade" className="text-sm text-black/45 hover:text-[#0F1A2E] transition">{t("footer.privacy")}</Link>
            <Link href="/termos" className="text-sm text-black/45 hover:text-[#0F1A2E] transition">{t("footer.terms")}</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
