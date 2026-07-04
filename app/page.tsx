import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  FileClock,
  Play,
  ShieldCheck,
  Unplug,
  UserX,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";

// ── SEO ───────────────────────────────────────────────────────────────────────
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.meta");
  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
      siteName: "AXIEL Core",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
    keywords: [
      "sistema para clínica", "gestão clínica", "prontuário eletrônico",
      "agenda online", "fisioterapia", "saúde mental", "nutrição", "saúde integrativa",
      "clinic management software", "integrative health", "patient journey",
    ],
  };
}

// ── Painéis ilustrativos dos 5 passos (mini-mockups abstratos em CSS) ─────────
// Todos decorativos (aria-hidden). Nenhum usa screenshot real.

const panelShell =
  "relative h-48 w-full overflow-hidden rounded-2xl border border-black/[.07] bg-white p-4 shadow-sm dark:border-white/[.07] dark:bg-[#111827]";

function PanelCalendar() {
  // TODO: substituir por print real
  return (
    <div className={panelShell} aria-hidden="true">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-2.5 w-20 rounded-full bg-[#0F1A2E]/15 dark:bg-white/15" />
        <div className="flex gap-1">
          <div className="h-4 w-4 rounded-md bg-[#F4F3EF] dark:bg-white/[.08]" />
          <div className="h-4 w-4 rounded-md bg-[#F4F3EF] dark:bg-white/[.08]" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 21 }).map((_, i) => (
          <div
            key={i}
            className={`h-6 rounded-md ${
              i === 10
                ? "bg-[#0F6E56] ring-2 ring-[#9FE1CB]"
                : i % 5 === 3
                  ? "bg-[#E1F5EE] dark:bg-[#0F6E56]/25"
                  : "bg-[#F4F3EF] dark:bg-white/[.06]"
            }`}
          />
        ))}
      </div>
      <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2 rounded-xl border border-[#9FE1CB] bg-[#F0FAF6] px-3 py-2 dark:border-[#0F6E56]/50 dark:bg-[#0F6E56]/15">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#25D366]" />
        <div className="h-2 w-2/3 rounded-full bg-[#0F6E56]/30" />
      </div>
    </div>
  );
}

function PanelForm() {
  // TODO: substituir por print real
  return (
    <div className={panelShell} aria-hidden="true">
      <div className="mx-auto flex h-full max-w-[220px] flex-col rounded-xl border border-black/[.06] bg-[#FAFAF8] p-3 dark:border-white/[.06] dark:bg-[#0B0F17]">
        <div className="mb-3 h-1.5 w-full rounded-full bg-[#F4F3EF] dark:bg-white/[.08]">
          <div className="h-1.5 w-2/3 rounded-full bg-[#0F6E56]" />
        </div>
        {[0, 1, 2].map((row) => (
          <div key={row} className="mb-2.5">
            <div className="mb-1.5 h-2 w-3/4 rounded-full bg-[#0F1A2E]/10 dark:bg-white/10" />
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full border ${
                    i === row + 1
                      ? "border-[#0F6E56] bg-[#0F6E56]"
                      : "border-black/15 bg-white dark:border-white/15 dark:bg-white/[.04]"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="mt-auto h-6 w-full rounded-lg bg-[#0F6E56]" />
      </div>
    </div>
  );
}

function PanelSession() {
  // TODO: substituir por print real
  return (
    <div className={panelShell} aria-hidden="true">
      <div className="flex h-full gap-3">
        <div className="flex-1 rounded-xl border border-black/[.06] bg-[#FAFAF8] p-3 dark:border-white/[.06] dark:bg-[#0B0F17]">
          <div className="mb-2 h-2.5 w-1/2 rounded-full bg-[#0F1A2E]/15 dark:bg-white/15" />
          <div className="space-y-1.5">
            {[100, 90, 75, 95, 60].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-[#0F1A2E]/[.08] dark:bg-white/[.08]" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <div className="flex w-[38%] flex-col gap-2">
          <div className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0F6E56] py-2.5">
            <span className="h-2 w-10 rounded-full bg-white/70" />
          </div>
          <div className="flex items-center justify-center rounded-xl border border-[#0F6E56]/40 py-2.5 dark:border-[#9FE1CB]/40">
            <span className="h-2 w-12 rounded-full bg-[#0F6E56]/40 dark:bg-[#9FE1CB]/40" />
          </div>
          <div className="mt-auto flex items-center gap-1.5 rounded-xl border border-[#9FE1CB] bg-[#F0FAF6] px-2.5 py-2 dark:border-[#0F6E56]/50 dark:bg-[#0F6E56]/15">
            <Check className="h-3 w-3 text-[#0F6E56] dark:text-[#9FE1CB]" />
            <span className="h-2 w-full rounded-full bg-[#0F6E56]/25" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelPyramid() {
  // TODO: substituir por print real
  return (
    <div className={panelShell} aria-hidden="true">
      <div className="flex h-full flex-col items-center justify-center gap-1.5">
        <div className="h-6 w-14 rounded-t-lg rounded-b-sm bg-[#0F6E56]" />
        <div className="h-6 w-24 rounded-sm bg-[#3E8E76]" />
        <div className="h-6 w-36 rounded-b-lg rounded-t-sm bg-[#9FE1CB]" />
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#0F1A2E] px-4 py-2 dark:bg-white/[.10]">
          <ArrowRight className="h-3 w-3 text-white" />
          <span className="h-2 w-16 rounded-full bg-white/60" />
        </div>
      </div>
    </div>
  );
}

function PanelBell() {
  // TODO: substituir por print real
  return (
    <div className={panelShell} aria-hidden="true">
      <div className="flex h-full items-center gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] dark:bg-[#0F6E56]/25">
          <Bell className="h-6 w-6 text-[#0F6E56] dark:text-[#9FE1CB]" />
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#EB5757]" />
        </div>
        <div className="flex-1 space-y-2.5">
          {["D-1", "D+3", "D+30"].map((label, i) => (
            <div key={label} className="flex items-center gap-2.5">
              <span className="w-10 shrink-0 rounded-md bg-[#F4F3EF] px-1.5 py-0.5 text-center text-[10px] font-semibold text-[#6B6A66] dark:bg-white/[.08] dark:text-[#9E9C97]">
                {label}
              </span>
              <div
                className={`h-2 rounded-full ${i === 0 ? "bg-[#0F6E56]" : "bg-[#0F1A2E]/[.10] dark:bg-white/[.10]"}`}
                style={{ width: `${85 - i * 20}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pirâmide Bio³ (SVG, 3 níveis) ─────────────────────────────────────────────
function Bio3Pyramid({ top, mid, base }: { top: string; mid: string; base: string }) {
  return (
    <svg viewBox="0 0 320 260" className="mx-auto w-full max-w-[340px]" role="img" aria-label={`${top} · ${mid} · ${base}`}>
      {/* Topo */}
      <polygon points="160,10 113,90 207,90" fill="#0F6E56" />
      <text x="160" y="76" textAnchor="middle" fontSize="11" fontWeight="600" fill="#FFFFFF">
        {top}
      </text>
      {/* Meio */}
      <polygon points="109,98 211,98 253,170 67,170" fill="#3E8E76" />
      <text x="160" y="140" textAnchor="middle" fontSize="13" fontWeight="600" fill="#FFFFFF">
        {mid}
      </text>
      {/* Base */}
      <polygon points="62,178 258,178 300,250 20,250" fill="#9FE1CB" />
      <text x="160" y="220" textAnchor="middle" fontSize="13" fontWeight="600" fill="#085041">
        {base}
      </text>
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function LandingPage() {
  const t = await getTranslations("landing");

  const painCards = [
    { icon: UserX, title: t("pain.card1Title"), text: t("pain.card1Text") },
    { icon: FileClock, title: t("pain.card2Title"), text: t("pain.card2Text") },
    { icon: Unplug, title: t("pain.card3Title"), text: t("pain.card3Text") },
  ];

  const journeySteps = [
    { title: t("journey.step1Title"), text: t("journey.step1Text"), panel: <PanelCalendar /> },
    { title: t("journey.step2Title"), text: t("journey.step2Text"), panel: <PanelForm /> },
    { title: t("journey.step3Title"), text: t("journey.step3Text"), panel: <PanelSession /> },
    { title: t("journey.step4Title"), text: t("journey.step4Text"), panel: <PanelPyramid /> },
    { title: t("journey.step5Title"), text: t("journey.step5Text"), panel: <PanelBell /> },
  ];

  const aiBullets = [t("ai.bullet1"), t("ai.bullet2"), t("ai.bullet3"), t("ai.bullet4")];
  const profileChips = [t("profiles.chip1"), t("profiles.chip2"), t("profiles.chip3"), t("profiles.chip4"), t("profiles.chip5")];
  const trustItems = [t("trust.item1"), t("trust.item2"), t("trust.item3"), t("trust.item4")];

  const plans = [
    {
      key: "starter",
      name: t("plans.starter.name"),
      price: t("plans.starter.price"),
      features: [t("plans.starter.f1"), t("plans.starter.f2"), t("plans.starter.f3")],
      highlighted: false,
    },
    {
      key: "professional",
      name: t("plans.professional.name"),
      price: t("plans.professional.price"),
      features: [t("plans.professional.f1"), t("plans.professional.f2"), t("plans.professional.f3"), t("plans.professional.f4")],
      highlighted: true,
    },
    {
      key: "scale",
      name: t("plans.scale.name"),
      price: t("plans.scale.price"),
      features: [t("plans.scale.f1"), t("plans.scale.f2"), t("plans.scale.f3"), t("plans.scale.f4")],
      highlighted: false,
    },
  ];

  const faq = Array.from({ length: 5 }, (_, i) => ({ q: t(`faq.q${i + 1}`), a: t(`faq.a${i + 1}`) }));

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0F1A2E] dark:bg-[#0B0F17] dark:text-[#E8E6E2]">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-black/[.06] bg-[#FAFAF8]/90 backdrop-blur-sm dark:border-white/[.07] dark:bg-[#0B0F17]/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="text-sm font-semibold tracking-[0.18em]">AXIEL CORE</span>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#tour" className="text-sm text-black/55 transition hover:text-[#0F1A2E] dark:text-[#9E9C97] dark:hover:text-[#E8E6E2]">{t("nav.tour")}</a>
            <a href="#jornada" className="text-sm text-black/55 transition hover:text-[#0F1A2E] dark:text-[#9E9C97] dark:hover:text-[#E8E6E2]">{t("nav.journey")}</a>
            <a href="#planos" className="text-sm text-black/55 transition hover:text-[#0F1A2E] dark:text-[#9E9C97] dark:hover:text-[#E8E6E2]">{t("nav.plans")}</a>
            <a href="#faq" className="text-sm text-black/55 transition hover:text-[#0F1A2E] dark:text-[#9E9C97] dark:hover:text-[#E8E6E2]">{t("nav.faq")}</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <Link href="/auth/login" className="text-sm text-black/55 transition hover:text-[#0F1A2E] dark:text-[#9E9C97] dark:hover:text-[#E8E6E2]">{t("nav.login")}</Link>
            <Link
              href="/auth/signup"
              className="hidden rounded-lg bg-[#0F1A2E] px-4 py-2 text-sm font-medium text-white transition hover:bg-black sm:block dark:bg-[#0F6E56] dark:hover:bg-[#085041]"
            >
              {t("nav.startFree")}
            </Link>
          </div>
        </div>
      </header>

      {/* ── 1. Hero ── */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl md:text-[60px]">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-black/55 dark:text-[#9E9C97]">
            {t("hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/auth/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F6E56] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#085041] sm:w-auto"
            >
              {t("hero.ctaPrimary")} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#tour"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-black/15 bg-white px-6 py-3.5 text-sm font-medium transition hover:bg-[#F4F3EF] sm:w-auto dark:border-white/15 dark:bg-white/[.06] dark:hover:bg-white/[.10]"
            >
              <Play className="h-4 w-4 fill-current" /> {t("hero.ctaSecondary")}
            </a>
          </div>
          <p className="mt-4 text-xs text-black/35 dark:text-[#6B6A66]">{t("hero.microProof")}</p>
        </div>

        {/* Vídeo-tour (Fase C — v11 aprovada) */}
        <div id="tour" className="mx-auto mt-14 max-w-4xl scroll-mt-24">
          <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-[#06080f] shadow-2xl dark:border-white/[.10]">
            <video
              controls
              playsInline
              preload="metadata"
              poster="/landing/tour-poster.jpg"
              aria-label={t("hero.videoLabel")}
              className="aspect-video w-full"
            >
              <source src="/landing/tour-pt.mp4" type="video/mp4" />
            </video>
          </div>
          <p className="mt-3 text-center text-xs text-black/35 dark:text-[#6B6A66]">{t("hero.videoCaption")}</p>
        </div>
      </section>

      {/* ── 2. A dor ── */}
      <section className="border-y border-black/[.06] bg-white py-20 dark:border-white/[.07] dark:bg-[#0E1117]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {painCards.map((card) => (
              <div key={card.title} className="rounded-2xl border border-black/[.07] bg-[#FAFAF8] p-6 dark:border-white/[.07] dark:bg-[#111827]">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAEEDA] dark:bg-[#C77D17]/20">
                  <card.icon className="h-5 w-5 text-[#633806] dark:text-[#E8B04B]" />
                </div>
                <h3 className="mb-2 text-base font-semibold">{card.title}</h3>
                <p className="text-sm leading-relaxed text-black/55 dark:text-[#9E9C97]">{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. A jornada em 5 passos ── */}
      <section id="jornada" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
        <div className="mb-14 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("journey.title")}</h2>
        </div>
        <div className="space-y-14 md:space-y-16">
          {journeySteps.map((step, i) => (
            <div
              key={step.title}
              className={`grid items-center gap-6 md:grid-cols-2 md:gap-14 ${i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}
            >
              <div>
                <span className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#0F6E56] text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="text-xl font-semibold leading-snug">{step.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-black/55 dark:text-[#9E9C97]">{step.text}</p>
              </div>
              {step.panel}
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. O diferencial Bio³ ── */}
      <section className="border-y border-black/[.06] bg-white py-24 dark:border-white/[.07] dark:bg-[#0E1117]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 md:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F6E56] dark:text-[#9FE1CB]">Bio³</p>
            <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("bio3.title")}</h2>
            <p className="mt-5 text-base leading-relaxed text-black/55 dark:text-[#9E9C97]">{t("bio3.body")}</p>
            <p className="mt-6 rounded-xl border border-[#9FE1CB] bg-[#F0FAF6] px-4 py-3 text-sm text-[#085041] dark:border-[#0F6E56]/50 dark:bg-[#0F6E56]/15 dark:text-[#9FE1CB]">
              {t("bio3.note")}
            </p>
          </div>
          <Bio3Pyramid top={t("bio3.labelTop")} mid={t("bio3.labelMid")} base={t("bio3.labelBase")} />
        </div>
      </section>

      {/* ── 5. IA com validação humana ── */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="rounded-3xl bg-[#E1F5EE] p-8 sm:p-10 md:p-14 dark:bg-[#0F6E56]/15">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("ai.title")}</h2>
            <ul className="space-y-3">
              {aiBullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 rounded-xl bg-white p-4 dark:bg-[#111827]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F6E56]">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                  <span className="text-sm leading-relaxed">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 6. Feito para a sua área ── */}
      <section className="mx-auto max-w-4xl px-4 pb-24 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("profiles.title")}</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          {profileChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[#0F6E56]/25 bg-white px-4 py-2 text-sm font-medium text-[#0F6E56] dark:border-[#9FE1CB]/25 dark:bg-white/[.06] dark:text-[#9FE1CB]"
            >
              {chip}
            </span>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-black/55 dark:text-[#9E9C97]">{t("profiles.body")}</p>
      </section>

      {/* ── 7. Confiança ── */}
      <section className="bg-[#0F1A2E] py-20 dark:bg-[#0E1117]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[.08]">
                <ShieldCheck className="h-6 w-6 text-[#9FE1CB]" />
              </div>
              <h2 className="text-3xl font-semibold tracking-[-0.025em] text-white sm:text-4xl">{t("trust.title")}</h2>
              <span className="mt-5 inline-block rounded-full border border-[#9FE1CB]/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#9FE1CB]">
                {t("trust.badge")}
              </span>
            </div>
            <ul className="space-y-3">
              {trustItems.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-xl bg-white/[.05] p-4">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#9FE1CB]" />
                  <span className="text-sm leading-relaxed text-white/80">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 8. Planos ── */}
      <section id="planos" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6">
        <div className="mb-14">
          <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("plans.title")}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-2xl p-7 ${
                plan.highlighted
                  ? "bg-[#0F1A2E] text-white dark:bg-[#0F6E56]"
                  : "border border-black/[.07] bg-white dark:border-white/[.07] dark:bg-[#111827]"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="whitespace-nowrap rounded-full bg-[#0F6E56] px-3 py-1 text-[11px] font-semibold text-white dark:bg-[#0F1A2E]">
                    {t("plans.mostPopular")}
                  </span>
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{plan.price}</span>
                  <span className={`mb-1 text-sm ${plan.highlighted ? "text-white/50" : "text-black/40 dark:text-[#6B6A66]"}`}>
                    {t("plans.perMonth")}
                  </span>
                </div>
                {plan.highlighted && (
                  <span className="mt-2 inline-block rounded-full bg-white/[.12] px-2.5 py-0.5 text-[11px] font-semibold text-[#9FE1CB]">
                    {t("plans.trialBadge")}
                  </span>
                )}
              </div>
              <ul className="mb-7 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted ? "text-[#9FE1CB]" : "text-[#0F6E56] dark:text-[#9FE1CB]"}`} />
                    <span className={`text-sm ${plan.highlighted ? "text-white/80" : "text-black/65 dark:text-[#9E9C97]"}`}>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className={`block rounded-lg px-5 py-3 text-center text-sm font-medium transition ${
                  plan.highlighted
                    ? "bg-white text-[#0F1A2E] hover:bg-[#F4F3EF]"
                    : "bg-[#0F1A2E] text-white hover:bg-black dark:bg-[#0F6E56] dark:hover:bg-[#085041]"
                }`}
              >
                {t("plans.ctaStart")}
              </Link>
            </div>
          ))}

          {/* Enterprise */}
          <div className="flex flex-col rounded-2xl border border-black/[.07] bg-white p-7 dark:border-white/[.07] dark:bg-[#111827]">
            <div className="mb-6">
              <h3 className="text-lg font-semibold">{t("plans.enterprise.name")}</h3>
              <div className="mt-3">
                <span className="text-3xl font-semibold tracking-tight text-[#0F6E56] dark:text-[#9FE1CB]">{t("plans.ctaContact")}</span>
              </div>
            </div>
            <ul className="mb-7 flex-1 space-y-3">
              {[t("plans.enterprise.f1"), t("plans.enterprise.f2")].map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0F6E56] dark:text-[#9FE1CB]" />
                  <span className="text-sm text-black/65 dark:text-[#9E9C97]">{feature}</span>
                </li>
              ))}
            </ul>
            <a
              href="mailto:marcelormoreira360@gmail.com"
              className="block rounded-lg border border-[#0F1A2E]/20 px-5 py-3 text-center text-sm font-medium transition hover:bg-[#F4F3EF] dark:border-white/20 dark:hover:bg-white/[.06]"
            >
              {t("plans.ctaContact")}
            </a>
          </div>
        </div>
      </section>

      {/* ── 9. FAQ ── */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 pb-24 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("faq.title")}</h2>
        </div>
        <div className="space-y-2">
          {faq.map((item) => (
            <details key={item.q} className="group rounded-2xl border border-black/[.07] bg-white dark:border-white/[.07] dark:bg-[#111827]">
              <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-4 px-6 py-5">
                <span className="text-[15px] font-medium leading-snug">{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-black/35 transition-transform duration-200 group-open:rotate-180 dark:text-[#6B6A66]" />
              </summary>
              <div className="px-6 pb-5">
                <p className="text-sm leading-relaxed text-black/55 dark:text-[#9E9C97]">{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── 10. CTA final ── */}
      <section className="border-t border-black/[.06] bg-white py-24 dark:border-white/[.07] dark:bg-[#0E1117]">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("cta.title")}</h2>
          <p className="mt-4 text-lg text-black/55 dark:text-[#9E9C97]">{t("cta.subtitle")}</p>
          <Link
            href="/auth/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0F6E56] px-8 py-4 text-base font-semibold text-white transition hover:bg-[#085041]"
          >
            {t("cta.button")} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-sm text-black/35 dark:text-[#6B6A66]">{t("hero.microProof")}</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-black/[.06] py-10 dark:border-white/[.07]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row">
          <span className="text-sm font-semibold tracking-[0.18em]">AXIEL CORE</span>
          <p className="text-sm text-black/35 dark:text-[#6B6A66]">{t("footer.rights")}</p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/auth/login" className="text-sm text-black/45 transition hover:text-[#0F1A2E] dark:text-[#9E9C97] dark:hover:text-[#E8E6E2]">{t("footer.login")}</Link>
            <a href="mailto:marcelormoreira360@gmail.com" className="text-sm text-black/45 transition hover:text-[#0F1A2E] dark:text-[#9E9C97] dark:hover:text-[#E8E6E2]">{t("footer.contact")}</a>
            <Link href="/privacidade" className="text-sm text-black/45 transition hover:text-[#0F1A2E] dark:text-[#9E9C97] dark:hover:text-[#E8E6E2]">{t("footer.privacy")}</Link>
            <Link href="/termos" className="text-sm text-black/45 transition hover:text-[#0F1A2E] dark:text-[#9E9C97] dark:hover:text-[#E8E6E2]">{t("footer.terms")}</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
