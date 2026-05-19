"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Building2, Check } from "lucide-react";
import { switchClinicAction } from "@/app/actions/switch-clinic";
import type { Clinic } from "@/lib/types";

export function ClinicSwitcher({
  clinics,
  activeClinicId,
}: {
  clinics: Clinic[];
  activeClinicId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const active = clinics.find((c) => c.id === activeClinicId) ?? clinics[0];

  if (clinics.length <= 1) {
    return (
      <div className="px-[14px] py-2 mb-1">
        <p className="text-[11px] font-medium text-[#0F1A2E]/60 dark:text-[#E8E6E2]/50 truncate">
          {active?.name ?? "Clínica"}
        </p>
      </div>
    );
  }

  function handleSwitch(clinicId: string) {
    setOpen(false);
    startTransition(() => switchClinicAction(clinicId));
  }

  return (
    <div className="relative px-[10px] mb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left hover:bg-black/[.05] dark:hover:bg-white/[.05] transition disabled:opacity-50"
      >
        <Building2 className="w-3.5 h-3.5 text-[#0F6E56] shrink-0" />
        <span className="flex-1 min-w-0 text-[11px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] truncate">
          {active?.name ?? "Clínica"}
        </span>
        <ChevronDown className={`w-3 h-3 text-black/30 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-[#1A1F2E] border border-black/[.08] dark:border-white/[.08] rounded-xl shadow-md py-1 mx-1">
          {clinics.map((clinic) => (
            <button
              key={clinic.id}
              onClick={() => handleSwitch(clinic.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/[.04] dark:hover:bg-white/[.04] transition"
            >
              <span className="flex-1 text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] truncate">
                {clinic.name}
              </span>
              {clinic.id === activeClinicId && (
                <Check className="w-3.5 h-3.5 text-[#0F6E56] shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
