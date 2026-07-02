"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Calendar,
  Sparkles,
  FileText,
  Banknote,
  MessageCircle,
  Link2,
  Inbox,
} from "lucide-react";
import { InboxBadge } from "./inbox-badge";

// `key` casa com a chave de tradução em messages/<locale>/nav.json
const mainNav = [
  { href: "/dashboard",   key: "dashboard",   icon: LayoutDashboard },
  { href: "/patients",    key: "patients",    icon: Users },
  { href: "/leads",       key: "leads",       icon: Megaphone, dot: true },
  { href: "/schedule",    key: "schedule",    icon: Calendar },
  { href: "/inbox",       key: "inbox",       icon: Inbox, liveCount: true },
  { href: "/financeiro",  key: "financeiro",  icon: Banknote },
  { href: "/actions",     key: "actions",     icon: Sparkles },
  { href: "/forms",       key: "forms",       icon: FileText },
  { href: "/links",       key: "links",       icon: Link2 },
];

const clinicNav = [
  { href: "/monetization",  key: "monetization" },
  { href: "/assinaturas",   key: "assinaturas" },
  { href: "/results",       key: "results" },
  { href: "/analytics",     key: "analytics" },
  { href: "/trends",        key: "trends" },
  // "Equipe" (dashboard de desempenho por profissional) fica fora do menu
  // enquanto a clínica é solo — não há profissionais para comparar. A página
  // segue acessível por /profissionais; reavaliar quando houver equipe.
  { href: "/relatorios",    key: "relatorios" },
  { href: "/settings",      key: "settings" },
];

const moreNav = [
  { href: "/automacoes",     key: "automacoes" },
  { href: "/whatsapp",       key: "whatsapp" },
  { href: "/follow-ups",     key: "follow-ups" },
  { href: "/communications", key: "communications" },
  { href: "/products",       key: "products" },
  { href: "/hotmart",        key: "hotmart" },
  { href: "/billing",        key: "billing" },
];

function NavItem({
  href,
  label,
  icon: Icon,
  dot,
  liveCount,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  dot?: boolean;
  liveCount?: boolean;
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
      {liveCount && <InboxBadge />}
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

export function SidebarNavigation({ canSeeFinance = true }: { canSeeFinance?: boolean }) {
  const t = useTranslations("nav");
  const items = mainNav.filter((i) => i.href !== "/financeiro" || canSeeFinance);
  return (
    <>
      {/* Principal */}
      <div className="px-[10px] mb-4">
        <p className="px-2 mb-[5px] text-[9px] font-medium tracking-[.1em] uppercase text-[#A09E98] dark:text-[#6B6A66]">
          {t("sections.main")}
        </p>
        <nav className="flex flex-col gap-[2px]">
          {items.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              dot={item.dot}
              liveCount={item.liveCount}
              label={t(`main.${item.key}`)}
            />
          ))}
        </nav>
      </div>

      {/* Clínica */}
      <div className="px-[10px] mb-4">
        <p className="px-2 mb-[5px] text-[9px] font-medium tracking-[.1em] uppercase text-[#A09E98] dark:text-[#6B6A66]">
          {t("sections.clinic")}
        </p>
        <nav className="flex flex-col gap-[2px]">
          {clinicNav.map((item) => (
            <QuietItem key={item.href} href={item.href} label={t(`clinic.${item.key}`)} />
          ))}
        </nav>
      </div>

      {/* Mais */}
      <div className="px-[10px] mb-4">
        <p className="px-2 mb-[5px] text-[9px] font-medium tracking-[.1em] uppercase text-[#A09E98] dark:text-[#6B6A66]">
          {t("sections.more")}
        </p>
        <nav className="flex flex-col gap-[2px]">
          {moreNav.map((item) => (
            <QuietItem key={item.href} href={item.href} label={t(`more.${item.key}`)} />
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
          <span>{t("support")}</span>
        </a>
      </div>
    </>
  );
}

export function MobileNav({ canSeeFinance = true }: { canSeeFinance?: boolean }) {
  const t = useTranslations("nav");
  const items = mainNav.filter((i) => i.href !== "/financeiro" || canSeeFinance);
  return (
    <nav className="mt-3 grid grid-cols-5 gap-1.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-lg bg-white/70 dark:bg-white/[.07] px-1.5 py-2.5 text-center text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97]"
        >
          {t(`main.${item.key}`)}
        </Link>
      ))}
    </nav>
  );
}
