"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Calendar,
  Sparkles,
  FileText,
  Banknote,
  MessageCircle,
} from "lucide-react";

const mainNav = [
  { href: "/dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { href: "/patients",    label: "Pacientes",   icon: Users },
  { href: "/leads",       label: "Leads",       icon: Megaphone, dot: true },
  { href: "/schedule",    label: "Agenda",      icon: Calendar },
  { href: "/financeiro",  label: "Financeiro",  icon: Banknote },
  { href: "/actions",     label: "AI Insights", icon: Sparkles },
  { href: "/forms",       label: "Formulários", icon: FileText },
];

const clinicNav = [
  { href: "/monetization", label: "Membership" },
  { href: "/relatorios",   label: "Relatórios" },
  { href: "/settings",     label: "Settings" },
];

const moreNav = [
  { href: "/follow-ups",     label: "Follow-ups" },
  { href: "/communications", label: "Messages" },
  { href: "/products",       label: "Products" },
  { href: "/billing",        label: "Billing" },
  { href: "/onboarding",     label: "Guided setup" },
];

function NavItem({
  href,
  label,
  icon: Icon,
  dot,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  dot?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2 px-2 py-[7px] rounded-lg text-[12px] transition-colors",
        active
          ? "bg-white dark:bg-white/[.08] text-[#0F1A2E] dark:text-[#E8E6E2] font-medium border border-black/[.08] dark:border-white/[.10]"
          : "text-[#6B6A66] dark:text-[#9E9C97] hover:bg-white/60 dark:hover:bg-white/[.06] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2]",
      ].join(" ")}
    >
      <Icon
        className={["h-[15px] w-[15px] shrink-0", active ? "text-[#0F6E56]" : "text-[#A09E98] dark:text-[#6B6A66]"].join(" ")}
        aria-hidden="true"
      />
      <span className="flex-1">{label}</span>
      {dot && (
        <span className="h-[5px] w-[5px] rounded-full bg-[#0F6E56]" aria-hidden="true" />
      )}
    </Link>
  );
}

function QuietItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={[
        "flex items-center px-2 py-[7px] rounded-lg text-[12px] transition-colors",
        active
          ? "bg-white dark:bg-white/[.08] text-[#0F1A2E] dark:text-[#E8E6E2] font-medium border border-black/[.08] dark:border-white/[.10]"
          : "text-[#6B6A66] dark:text-[#9E9C97] hover:bg-white/60 dark:hover:bg-white/[.06] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2]",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export function SidebarNavigation() {
  return (
    <>
      {/* Principal */}
      <div className="px-[10px] mb-4">
        <p className="px-2 mb-[5px] text-[9px] font-medium tracking-[.1em] uppercase text-[#A09E98] dark:text-[#6B6A66]">
          Principal
        </p>
        <nav className="flex flex-col gap-[2px]">
          {mainNav.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </nav>
      </div>

      {/* Clínica */}
      <div className="px-[10px] mb-4">
        <p className="px-2 mb-[5px] text-[9px] font-medium tracking-[.1em] uppercase text-[#A09E98] dark:text-[#6B6A66]">
          Clínica
        </p>
        <nav className="flex flex-col gap-[2px]">
          {clinicNav.map((item) => (
            <QuietItem key={item.href} {...item} />
          ))}
        </nav>
      </div>

      {/* More */}
      <div className="px-[10px] mb-4">
        <p className="px-2 mb-[5px] text-[9px] font-medium tracking-[.1em] uppercase text-[#A09E98] dark:text-[#6B6A66]">
          More
        </p>
        <nav className="flex flex-col gap-[2px]">
          {moreNav.map((item) => (
            <QuietItem key={item.href} {...item} />
          ))}
        </nav>
      </div>

      {/* Support */}
      <div className="px-[10px] mt-auto pb-4">
        <a
          href="https://wa.me/16892803705"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-2 py-[7px] rounded-lg text-[12px] text-[#6B6A66] dark:text-[#9E9C97] hover:bg-white/60 dark:hover:bg-white/[.06] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition-colors"
        >
          <MessageCircle className="h-[15px] w-[15px] shrink-0 text-[#A09E98] dark:text-[#6B6A66]" aria-hidden="true" />
          <span>Support</span>
        </a>
      </div>
    </>
  );
}

export function MobileNav() {
  return (
    <nav className="mt-3 grid grid-cols-5 gap-1.5">
      {mainNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-lg bg-white/70 dark:bg-white/[.07] px-1.5 py-2.5 text-center text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97]"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
