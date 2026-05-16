import Link from "next/link";
import { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { SoftOnboardingGuide } from "@/components/soft-onboarding-guide";
import { SidebarNavigation, MobileNav } from "@/components/sidebar-nav";

export function Shell({
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

  return (
    <div className="flex min-h-screen bg-[#FAFAF8]">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-[176px] shrink-0 bg-[#F4F3EF] border-r border-black/[.06] sticky top-0 h-screen overflow-y-auto py-5">
        {/* Logo */}
        <div className="px-[18px] pb-[22px] text-[17px] font-medium tracking-[-0.035em] text-[#0F1A2E] select-none">
          AXI<span className="text-[#0F6E56]">EL</span>
        </div>

        <SidebarNavigation />

        {/* User */}
        <div className="mt-auto px-[14px] pt-3 border-t border-black/[.08]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[10px] font-medium text-[#0F6E56] shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              {userName && (
                <p className="text-[11px] font-medium text-[#0F1A2E] truncate leading-tight">{userName}</p>
              )}
              {userRole && (
                <p className="text-[10px] text-[#A09E98] truncate leading-tight">{userRole}</p>
              )}
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {/* ── Mobile topbar ── */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-20 bg-[#F4F3EF]/95 backdrop-blur border-b border-black/[.06] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="text-[17px] font-medium tracking-[-0.035em] text-[#0F1A2E]"
          >
            AXI<span className="text-[#0F6E56]">EL</span>
          </Link>
          <SignOutButton />
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
    </div>
  );
}
