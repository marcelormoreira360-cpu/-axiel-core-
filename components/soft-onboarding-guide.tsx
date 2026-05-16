"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarPlus, CheckCircle2, UsersRound, UserPlus, X } from "lucide-react";

const STORAGE_KEY = "axiel-soft-onboarding-dismissed";

const steps = [
  {
    label: "Step 1",
    title: "Review your first lead",
    href: "/leads",
    action: "Open leads",
    icon: UsersRound,
  },
  {
    label: "Step 2",
    title: "Create your first patient",
    href: "/patients/new",
    action: "Add patient",
    icon: UserPlus,
  },
  {
    label: "Step 3",
    title: "Schedule your first session",
    href: "/schedule/new",
    action: "Book session",
    icon: CalendarPlus,
  },
];

export function SoftOnboardingGuide() {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(STORAGE_KEY);
    setIsVisible(dismissed !== "true");
  }, []);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setIsVisible(false);
  }

  if (!isVisible || pathname.startsWith("/onboarding")) return null;

  return (
    <aside className="fixed bottom-5 right-5 z-50 w-[calc(100vw-40px)] max-w-sm rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-axiel-soft px-3 py-1 text-xs font-semibold text-black/55">
            <CheckCircle2 className="h-3.5 w-3.5 text-axiel-gold" /> Quick start
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-axiel-ink">Start with 3 simple steps</h2>
          <p className="mt-1 text-sm leading-5 text-black/45">A calm guide for your first day.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-full p-2 text-black/35 transition hover:bg-axiel-soft hover:text-black"
          aria-label="Dismiss onboarding guide"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {steps.map((step) => (
          <Link
            key={step.title}
            href={step.href}
            className="group flex items-center justify-between gap-3 rounded-[1.35rem] border border-transparent bg-axiel-soft/70 p-3 transition hover:border-axiel-line hover:bg-white"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-axiel-gold shadow-sm">
                <step.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/35">{step.label}</p>
                <p className="truncate text-sm font-semibold text-axiel-ink">{step.title}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-semibold text-black/55 transition group-hover:bg-axiel-ink group-hover:text-white">
              {step.action}
            </span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="mt-3 w-full rounded-full px-4 py-3 text-sm font-semibold text-black/45 transition hover:bg-axiel-soft hover:text-black"
      >
        Dismiss guide
      </button>
    </aside>
  );
}
