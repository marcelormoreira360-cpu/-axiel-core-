"use client";

import { useState, useRef, useTransition } from "react";

interface TeleconsultaNotesProps {
  appointmentId: string;
  patientId: string;
  clinicId: string;
  initialNotes: string;
  initialObservations: string[];
  saveAction: (appointmentId: string, notes: string, observations: string[]) => Promise<void>;
}

export function TeleconsultaNotes({
  appointmentId,
  patientId,
  clinicId,
  initialNotes,
  initialObservations,
  saveAction,
}: TeleconsultaNotesProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [observations, setObservations] = useState<string[]>(initialObservations);
  const [newObs, setNewObs] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerSave(nextNotes: string, nextObs: string[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus("saving");
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        await saveAction(appointmentId, nextNotes, nextObs);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      });
    }, 1200);
  }

  function handleNotesChange(val: string) {
    setNotes(val);
    triggerSave(val, observations);
  }

  function addObservation() {
    const trimmed = newObs.trim();
    if (!trimmed) return;
    const next = [...observations, trimmed];
    setObservations(next);
    setNewObs("");
    triggerSave(notes, next);
  }

  function removeObservation(idx: number) {
    const next = observations.filter((_, i) => i !== idx);
    setObservations(next);
    triggerSave(notes, next);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Notes textarea */}
      <div>
        <div className="flex items-center justify-between mb-[6px]">
          <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] dark:text-[#6B6A66]">
            Notas da sessão
          </p>
          <span className={`text-[10px] transition ${
            saveStatus === "saving" ? "text-[#A09E98]" :
            saveStatus === "saved"  ? "text-[#0F6E56]" : "text-transparent"
          }`}>
            {saveStatus === "saving" ? "Salvando…" : "Salvo ✓"}
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Observe e anote durante a consulta…"
          rows={7}
          className="w-full text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-white dark:bg-[#1C2333] border border-black/[.10] dark:border-white/[.10] rounded-[10px] px-[13px] py-[10px] resize-none outline-none focus:border-[#0F6E56] transition placeholder:text-[#C5C3BC] dark:placeholder:text-[#6B6A66] leading-relaxed"
        />
      </div>

      {/* Key observations */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] dark:text-[#6B6A66] mb-[8px]">
          Observações-chave
        </p>
        <div className="flex flex-wrap gap-[6px] mb-[8px]">
          {observations.map((obs, i) => (
            <span
              key={i}
              className="flex items-center gap-[5px] text-[11px] text-[#0F6E56] bg-[#E1F5EE] dark:bg-[#0F6E56]/20 border border-[#9FE1CB] dark:border-[#0F6E56]/30 rounded-full px-[10px] py-[3px]"
            >
              {obs}
              <button
                onClick={() => removeObservation(i)}
                className="text-[#0F6E56]/60 hover:text-[#0F6E56] transition ml-[1px]"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newObs}
            onChange={(e) => setNewObs(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addObservation(); } }}
            placeholder="Adicionar observação…"
            className="flex-1 text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-white dark:bg-[#1C2333] border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[6px] outline-none focus:border-[#0F6E56] transition placeholder:text-[#C5C3BC] dark:placeholder:text-[#6B6A66]"
          />
          <button
            onClick={addObservation}
            className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[12px] py-[6px] rounded-[8px]"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
