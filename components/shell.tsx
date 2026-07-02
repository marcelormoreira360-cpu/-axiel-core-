import Link from "next/link";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import Image from "next/image";
import { cookies } from "next/headers";
import { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { SoftOnboardingGuide } from "@/components/soft-onboarding-guide";
import { PushPrompt } from "@/components/push-prompt";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { GlobalSearch, SearchTriggerButton } from "@/components/global-search";
import { SidebarNavigation, MobileNav } from "@/components/sidebar-nav";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NotificationBell } from "@/components/notification-bell";
import { ClinicSwitcher } from "@/components/clinic-switcher";
import { getClinicsForUser, getCurrentClinic, ACTIVE_CLINIC_COOKIE } from "@/services/clinic-service";
import { getClinicSubscription } from "@/services/billing-service";
import { getClinicCurrency } from "@/services/finance-service";
import { getLocale, getTranslations } from "next-intl/server";
import { CurrencyProvider } from "@/components/currency-provider";

export async function Shell({
  children,
  userName,
  userRole,
  fullWidth = false,
  billingLockExempt = false,
}: {
  children: ReactNode;
  userName?: string | null;
  userRole?: string | null;
  /** Remove max-w-5xl e reduz padding — ideal para páginas de agenda/tabela */
  fullWidth?: boolean;
  /** Páginas de escape do lock de trial expirado (/upgrade, /billing) */
  billingLockExempt?: boolean;
}) {
  const initials = userName
    ? userName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  // Wrap in try-catch to prevent unhandled rejection in Next.js 16 RSC error boundary
  let clinics: Awaited<ReturnType<typeof getClinicsForUser>> = [];
  let cookieStore: Awaited<ReturnType<typeof cookies>>;
  let clinic: Awaited<ReturnType<typeof getCurrentClinic>> = null;

  let profile: Awaited<ReturnType<typeof import("@/services/user-service").getCurrentUserProfile>> = null;
  try {
    const userService = await import("@/services/user-service");
    [clinics, cookieStore, clinic, profile] = await Promise.all([
      getClinicsForUser().catch(() => []),
      cookies(),
      getCurrentClinic().catch(() => null),
      userService.getCurrentUserProfile().catch(() => null),
    ]);
  } catch (e) {
    throw e;
  }
  const activeClinicId = cookieStore!.get(ACTIVE_CLINIC_COOKIE)?.value ?? clinics[0]?.id ?? "";
  const { isManager } = await import("@/lib/team-utils");
  const canSeeFinance = profile ? isManager(profile.role) : false;

  // ── Trial / billing status ──────────────────────────────────────────────────
  // Fetch subscription lightly (React.cache deduplicates if already called).
  const clinicId = clinic?.id ?? clinics[0]?.id ?? null;
  const subscription = clinicId
    ? await getClinicSubscription(clinicId).catch(() => null)
    : null;

  const subStatus = (subscription as { status?: string | null } | null)?.status ?? null;
  const trialEndsAtRaw = (subscription as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null;
  const trialExpired =
    subStatus === "trialing" && trialEndsAtRaw != null
      ? new Date(trialEndsAtRaw) < new Date()
      : false;
  const isPastDue = subStatus === "past_due";
  const showBillingBanner = trialExpired || isPastDue;

  const logoUrl = clinic?.logo_url ?? null;
  const primaryColor = clinic?.primary_color ?? "#0F6E56";
  const clinicName = clinic?.name ?? "AXIEL";

  // Moeda da clínica (BRL/USD/EUR) — vem da config da clínica, não do idioma.
  const tShell = await getTranslations("common");
  const [clinicCurrency, shellLocale] = await Promise.all([
    clinicId ? getClinicCurrency(clinicId).catch(() => "BRL") : Promise.resolve("BRL"),
    getLocale().catch(() => "pt-BR"),
  ]);

  return (
    <div className="flex min-h-screen bg-[#FAFAF8] dark:bg-[#0E1117]">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[176px] shrink-0 bg-[#F4F3EF] dark:bg-[#0B0F17] border-r border-black/[.06] dark:border-white/[.07] sticky top-0 h-screen overflow-y-auto py-5">
        {/* Logo / Clinic identity */}
        <Link href="/dashboard" className="px-[18px] pb-[14px] block select-none">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={clinicName}
              width={140}
              height={36}
              className="h-9 w-auto max-w-[140px] object-contain"
              unoptimized
            />
          ) : (
            <div className="text-[17px] font-semibold tracking-[-0.035em] text-[#0F1A2E] dark:text-[#E8E6E2]">
              <span style={{ color: primaryColor }}>●</span>{" "}
              <span className="text-[14px]">{clinicName}</span>
            </div>
          )}
        </Link>

        {/* Clinic switcher */}
        {clinics.length > 0 && (
          <ClinicSwitcher clinics={clinics} activeClinicId={activeClinicId} />
        )}

        {/* Search trigger */}
        <div className="px-[10px] pb-[6px]">
          <SearchTriggerButton />
        </div>

        <SidebarNavigation canSeeFinance={canSeeFinance} />

        {/* User */}
        <div className="mt-auto px-[14px] pt-3 border-t border-black/[.08] dark:border-white/[.08]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-[#E1F5EE] dark:bg-[#0F6E56]/20 flex items-center justify-center text-[10px] font-medium text-[#0F6E56] shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              {userName && (
                <p className="text-[11px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] truncate leading-tight">{userName}</p>
              )}
              {userRole && (
                <p className="text-[10px] text-[#A09E98] dark:text-[#6B6A66] truncate leading-tight">{userRole}</p>
              )}
            </div>
            <NotificationBell />
            <DarkModeToggle />
          </div>
          <div className="mb-2">
            <LanguageSwitcher />
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* ── Mobile topbar ── */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-20 bg-[#F4F3EF]/95 dark:bg-[#0B0F17]/95 backdrop-blur border-b border-black/[.06] dark:border-white/[.07] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="flex items-center">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={clinicName}
                width={100}
                height={28}
                className="h-7 w-auto max-w-[100px] object-contain"
                unoptimized
              />
            ) : (
              <span className="text-[17px] font-semibold tracking-[-0.035em] text-[#0F1A2E] dark:text-[#E8E6E2]">
                <span style={{ color: primaryColor }}>●</span>{" "}
                <span className="text-[14px]">{clinicName}</span>
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <NotificationBell />
            <DarkModeToggle />
            <SignOutButton />
          </div>
        </div>
        <MobileNav canSeeFinance={canSeeFinance} />
      </div>

      {/* ── Page content ── */}
      <main className="flex-1 min-w-0 pt-[84px] lg:pt-0">
        {/* Trial-expired / past_due banner */}
        {showBillingBanner && (
          <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-[12px]">
            <div className="flex items-center gap-2 min-w-0">
              <svg
                className="w-3.5 h-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="font-medium truncate">
                {isPastDue
                  ? "Pagamento pendente — seu acesso pode ser suspenso em breve."
                  : "Seu trial expirou — escolha um plano para continuar."}
              </span>
            </div>
            <Link
              href="/upgrade"
              className="shrink-0 bg-white text-amber-600 font-semibold text-[11px] px-3 py-1 rounded-full hover:bg-amber-50 transition"
            >
              Assinar agora
            </Link>
          </div>
        )}

        <div className={fullWidth ? "px-4 py-4 lg:px-6 lg:py-5" : "mx-auto max-w-5xl px-5 py-6 lg:px-8 lg:py-8"}>
          <CurrencyProvider currency={clinicCurrency} locale={shellLocale}>
            {trialExpired && !billingLockExempt ? (
              <div className="mx-auto max-w-lg py-16 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">⏳</div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#0F1A2E]">{tShell("trialLock.title")}</h1>
                <p className="mt-3 text-sm text-black/55">{tShell("trialLock.body")}</p>
                <Link
                  href="/upgrade"
                  className="mt-8 inline-flex items-center justify-center rounded-lg bg-axiel-blue px-8 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5"
                >
                  {tShell("trialLock.cta")}
                </Link>
                <p className="mt-4 text-xs text-black/35">{tShell("trialLock.helper")}</p>
              </div>
            ) : (
              <>{children}</>
            )}
          </CurrencyProvider>
        </div>
      </main>

      <SoftOnboardingGuide />
      <MobileBottomNav />
      <GlobalSearch key="global-search-modal" />
      <PushPrompt />
    </div>
  );
}
