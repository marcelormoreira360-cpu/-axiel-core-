import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  text,
  href,
  action,
  icon,
}: {
  title: string;
  text: string;
  href?: string;
  action?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-black/10 bg-white p-8 text-center shadow-sm transition duration-200 hover:shadow-md md:p-10">
      {icon ? <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-axiel-soft text-axiel-gold">{icon}</div> : null}
      <h2 className="text-2xl font-semibold tracking-tight text-axiel-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/50">{text}</p>
      {href && action ? (
        <Link href={href} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-axiel-blue px-6 text-sm font-semibold text-white shadow-md transition hover:bg-axiel-blueDark">
          {action}
        </Link>
      ) : null}
    </div>
  );
}
