"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Banknote,
  Menu,
} from "lucide-react";
import { useState } from "react";

const PRIMARY_NAV = [
  { href: "/dashboard",   label: "Início",     icon: LayoutDashboard },
  { href: "/schedule",    label: "Agenda",     icon: Calendar },
  { href: "/patients",    label: "Pacientes",  icon: Users },
  { href: "/financeiro",  label: "Financeiro", icon: Banknote },
];

const MORE_NAV = [
  { href: "/leads",        label: "Leads" },
  { href: "/inbox",        label: "Mensagens" },
  { href: "/forms",        label: "Formulários" },
  { href: "/results",      label: "Resultados" },
  { href: "/analytics",    label: "Analytics" },
  { href: "/actions",      label: "AI Insights" },
  { href: "/settings",     label: "Configurações" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  // Hide on onboarding, auth, public pages and large screens (handled via CSS)
  const hidden =
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/book") ||
    pathname === "/";

  if (hidden) return null;

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] md:hidden"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-t border-black/[.07] dark:border-white/[.07]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* More drawer */}
        {showMore && (
          <div className="border-b border-black/[.05] dark:border-white/[.05] px-2 pt-2 pb-1">
            <div className="grid grid-cols-4 gap-1">
              {MORE_NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={[
                      "rounded-[8px] px-2 py-2 text-center text-[11px] font-medium transition",
                      active
                        ? "bg-[#0F1A2E] text-white dark:bg-white dark:text-[#0F1A2E]"
                        : "text-[#6B6A66] dark:text-[#9E9C97] hover:bg-[#F4F3EF] dark:hover:bg-white/[.07]",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Primary tabs */}
        <div className="flex items-stretch h-[60px]">
          {PRIMARY_NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center justify-center gap-[3px] transition-colors"
                onClick={() => setShowMore(false)}
              >
                <item.icon
                  className={`h-[20px] w-[20px] ${active ? "text-[#0F6E56]" : "text-[#A09E98] dark:text-[#6B6A66]"}`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <span
                  className={`text-[9px] font-medium leading-none ${active ? "text-[#0F6E56]" : "text-[#A09E98] dark:text-[#6B6A66]"}`}
                >
                  {item.label}
                </span>
                {active && (
                  <span className="absolute bottom-0 h-[2px] w-8 rounded-full bg-[#0F6E56]" />
                )}
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="flex flex-1 flex-col items-center justify-center gap-[3px] transition-colors"
          >
            <Menu
              className={`h-[20px] w-[20px] ${showMore ? "text-[#0F6E56]" : "text-[#A09E98] dark:text-[#6B6A66]"}`}
              strokeWidth={showMore ? 2.2 : 1.8}
            />
            <span
              className={`text-[9px] font-medium leading-none ${showMore ? "text-[#0F6E56]" : "text-[#A09E98] dark:text-[#6B6A66]"}`}
            >
              Mais
            </span>
          </button>
        </div>
      </nav>

      {/* Spacer so content isn't hidden behind nav */}
      <div
        className="md:hidden"
        style={{ height: `calc(60px + env(safe-area-inset-bottom, 0px))` }}
        aria-hidden
      />
    </>
  );
}
