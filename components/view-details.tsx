"use client";

import { ChevronDown } from "lucide-react";
import { ReactNode } from "react";

export function ViewDetails({
  label = "View details",
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group rounded-xl border border-axiel-line bg-white p-6 shadow-sm ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-black/50">
        <span>{label}</span>
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="mt-4 border-t border-axiel-line pt-4">{children}</div>
    </details>
  );
}
