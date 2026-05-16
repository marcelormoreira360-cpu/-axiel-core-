import Link from "next/link";
import { ChevronRight, LucideIcon } from "lucide-react";

export function BigAction({ href, title, helper, icon: Icon }: { href: string; title: string; helper: string; icon: LucideIcon }) {
  return (
    <Link href={href} className="group flex min-h-36 flex-col justify-between rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-axiel-soft">
          <Icon className="h-6 w-6 text-axiel-gold" />
        </span>
        <ChevronRight className="h-6 w-6 text-black/25 transition group-hover:translate-x-1" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-black/50">{helper}</p>
      </div>
    </Link>
  );
}
