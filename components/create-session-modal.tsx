"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useRef } from "react";
import { X, Search } from "lucide-react";
import type { Patient, SessionType } from "@/lib/types";
import type { TimeSlot } from "@/modules/schedule/time-slots";
import { buildStartsAtForToday, buildStartsAtForDate } from "@/modules/schedule/time-slots";

export function CreateSessionModal({
  slot,
  patients,
  sessionTypes,
  onClose,
  action,
}: {
  slot: TimeSlot | null;
  patients: Patient[];
  sessionTypes: SessionType[];
  onClose: () => void;
  action: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  // If no session types are configured, fall back to a default 60-min slot
  const DEFAULT_TYPE: SessionType = {
    id: "", clinic_id: "", name: "Sessão padrão", duration_minutes: 60,
    price_cents: 0, is_active: true, is_online: false, is_recorded: false,
    created_at: "", updated_at: "",
  };
  const [selectedType, setSelectedType] = useState<SessionType | null>(sessionTypes[0] ?? DEFAULT_TYPE);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!slot) return null;

  const filtered = query.trim().length > 0
    ? patients.filter((p) =>
        p.full_name.toLowerCase().includes(query.toLowerCase()) ||
        (p.email ?? "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  function pickPatient(patient: Patient) {
    setSelectedPatient(patient);
    setQuery(patient.full_name);
  }

  function submit(formData: FormData) {
    if (!selectedPatient || !selectedType) return;
    formData.set("patient_id", selectedPatient.id);
    formData.set("duration_minutes", String(selectedType.duration_minutes));
    startTransition(async () => {
      await action(formData);
      onClose();
      router.refresh();
    });
  }

  const canSubmit = !!selectedPatient && !!selectedType && !isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-[#0F1A2E]/30 backdrop-blur-[2px]"
      />

      <form
        action={submit}
        className="relative w-full max-w-[420px] bg-white rounded-[16px] border border-black/[.08] shadow-xl p-6"
      >
        <input
          type="hidden"
          name="starts_at"
          value={
            slot.date
              ? buildStartsAtForDate(slot.date, slot.hour, slot.minute)
              : buildStartsAtForToday(slot.hour, slot.minute)
          }
        />

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98]">Nova sessão</p>
            <h2 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E] mt-[2px]">
              {slot.label}
              {slot.date && (
                <span className="ml-2 text-[13px] font-normal text-[#A09E98]">
                  {slot.date.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Patient search */}
        <div className="mb-4">
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">Paciente</label>
          <div className="relative">
            <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[13px] w-[13px] text-[#A09E98] pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selectedPatient && e.target.value !== selectedPatient.full_name) {
                  setSelectedPatient(null);
                }
              }}
              placeholder="Buscar paciente..."
              autoComplete="off"
              className="w-full pl-[30px] pr-3 py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
            />
          </div>

          {/* Results dropdown */}
          {filtered.length > 0 && !selectedPatient && (
            <div className="mt-[4px] bg-white border border-black/[.08] rounded-[8px] overflow-hidden shadow-sm">
              {filtered.map((patient, i) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => pickPatient(patient)}
                  className={[
                    "w-full text-left px-[12px] py-[9px] hover:bg-[#F4F3EF] transition flex items-center gap-[8px]",
                    i !== filtered.length - 1 ? "border-b border-black/[.05]" : "",
                  ].join(" ")}
                >
                  <div className="w-6 h-6 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[9px] font-medium text-[#0F6E56] shrink-0">
                    {patient.full_name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-[#0F1A2E]">{patient.full_name}</p>
                    {patient.email && <p className="text-[10px] text-[#A09E98]">{patient.email}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected patient confirmation */}
          {selectedPatient && (
            <div className="mt-[4px] flex items-center gap-[8px] px-[10px] py-[7px] bg-[#E1F5EE] rounded-[8px]">
              <span className="text-[12px] text-[#085041] font-medium flex-1">{selectedPatient.full_name}</span>
              <button
                type="button"
                onClick={() => { setSelectedPatient(null); setQuery(""); inputRef.current?.focus(); }}
                className="text-[#A09E98] hover:text-[#0F1A2E] transition"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Treatment type */}
        <div className="mb-5">
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">Tipo de tratamento</label>
          <div className="space-y-[5px]">
            {sessionTypes.length === 0 ? (
              <div className="px-[12px] py-[9px] rounded-[8px] border border-[#0F6E56] bg-[#F0FAF6] flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#0F6E56]">Sessão padrão</span>
                <span className="text-[11px] text-[#0F6E56]">60 min</span>
              </div>
            ) : sessionTypes.map((type) => {
              const isSelected = selectedType?.id === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={[
                    "w-full flex items-center justify-between px-[12px] py-[9px] rounded-[8px] border text-left transition",
                    isSelected
                      ? "border-[#0F6E56] bg-[#F0FAF6]"
                      : "border-black/[.08] hover:border-black/[.16] bg-white",
                  ].join(" ")}
                >
                  <span className={`text-[12px] font-medium ${isSelected ? "text-[#0F6E56]" : "text-[#0F1A2E]"}`}>
                    {type.name}
                  </span>
                  <span className={`text-[11px] ${isSelected ? "text-[#0F6E56]" : "text-[#A09E98]"}`}>
                    {type.duration_minutes} min
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-[12px] font-medium text-[#6B6A66] border border-black/[.10] rounded-[8px] py-[9px] hover:bg-[#F4F3EF] transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 rounded-[8px] py-[9px] transition"
          >
            {isPending ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </form>
    </div>
  );
}
