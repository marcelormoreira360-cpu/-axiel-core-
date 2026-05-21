import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { SoftOnboardingGuide } from "@/components/soft-onboarding-guide";
import { GlobalSearch, SearchTriggerButton } from "@/components/global-search";
import { SidebarNavigation, MobileNav } from "@/components/sidebar-nav";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { ClinicSwitcher } from "@/components/clinic-switcher";
import { getClinicsForUser, getCurrentClinic, ACTIVE_CLINIC_COOKIE } from "@/services/clinic-service";

export async function Shell({
  children,
  userName,
  userRole,
}: {
  children: ReactNode;
  userName?: string | null;
  userRole?: string | null;
}) {
  const initials = userName
    ? userName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const [clinics, cookieStore, clinic] = await Promise.all([
    getClinicsForUser().catch(() => []),
    cookies(),
    getCurrentClinic().catch(() => null),
  ]);
  const activeClinicId = cookieStore.get(ACTIVE_CLINIC_COOKIE)?.value ?? clinics[0]?.id ?? "";

  const logoUrl = clinic?.logo_url ?? null;
  const primaryColor = clinic?.primary_color ?? "#0F6E56";
  const clinicName = clinic?.name ?? "AXIEL";

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

        <SidebarNavigation />

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
            <DarkModeToggle />
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
            <DarkModeToggle />
            <SignOutButton />
          </div>
        </div>
        <MobileNav />
      </div>

      {/* ── Page content ── */}
      <main className="flex-1 min-w-0 pt-[84px] lg:pt-0">
        <div className="mx-auto max-w-5xl px-5 py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      <SoftOnboardingGuide />
      <GlobalSearch key="global-search-modal" />
    </div>
  );
}
