"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import type { Patient } from "@/lib/types";

export function FormPatientPicker({
  patients,
  templateId,
}: {
  patients: Patient[];
  templateId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered =
    query.trim().length > 0
      ? patients
          .filter(
            (p) =>
              p.full_name.toLowerCase().includes(query.toLowerCase()) ||
              (p.email ?? "").toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 6)
      : [];

  function pick(patient: Patient) {
    setSelected(patient);
    setQuery(patient.full_name);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    inputRef.current?.focus();
  }

  function go() {
    if (!selected) return;
    router.push(`/patients/${selected.id}/forms/new?template=${templateId}`);
  }

  return (
    <div>
      <div className="relative mb-[8px]">
        <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[13px] w-[13px] text-[#A09E98] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected && e.target.value !== selected.full_name) setSelected(null);
          }}
          placeholder="Buscar paciente..."
          autoComplete="off"
          className="w-full pl-[30px] pr-3 py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
        />
      </div>

      {/* Dropdown */}
      {filtered.length > 0 && !selected && (
        <div className="mb-[8px] bg-white border border-black/[.08] rounded-[8px] overflow-hidden shadow-sm">
          {filtered.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className={[
                "w-full text-left px-[12px] py-[9px] hover:bg-[#F4F3EF] transition flex items-center gap-[8px]",
                i !== filtered.length - 1 ? "border-b border-black/[.05]" : "",
              ].join(" ")}
            >
              <div className="w-6 h-6 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[9px] font-medium text-[#0F6E56] shrink-0">
                {p.full_name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div>
                <p className="text-[12px] font-medium text-[#0F1A2E]">{p.full_name}</p>
                {p.email && <p className="text-[10px] text-[#A09E98]">{p.email}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected */}
      {selected && (
        <div className="mb-[10px] flex items-center gap-[8px] px-[10px] py-[7px] bg-[#E1F5EE] rounded-[8px]">
          <span className="text-[12px] text-[#085041] font-medium flex-1">{selected.full_name}</span>
          <button type="button" onClick={clear} className="text-[#A09E98] hover:text-[#0F1A2E] transition">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={go}
        disabled={!selected}
        className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 rounded-[8px] py-[9px] transition"
      >
        Preencher formulário <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
