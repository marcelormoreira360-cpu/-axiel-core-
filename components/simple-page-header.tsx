import Link from "next/link";
import { ReactNode } from "react";

export function SimplePageHeader({
  eyebrow,
  title,
  helper,
  actionHref,
  actionLabel,
}: {
  eyebrow?: string;
  title: string;
  helper?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 pt-2 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="text-xs font-semibold tracking-[0.22em] text-axiel-gold">{eyebrow}</p> : null}
        <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        {helper ? <p className="mt-3 max-w-2xl text-base leading-7 text-black/55 dark:text-white/55">{helper}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="inline-flex min-h-14 items-center justify-center rounded-lg bg-axiel-blue px-7 text-base font-semibold text-white shadow-md">
          {actionLabel}
        </Link>
      ) : null}
    </header>
  );
}
