"use client";

import { useRef, useState } from "react";
import type { BodyMapMarker } from "@/lib/types";

type InputProps = {
  src: string | null;
  markers: BodyMapMarker[];
  notes: string;
  onChange: (markers: BodyMapMarker[], notes: string) => void;
  hint: string;
  notesPlaceholder: string;
  clearLabel: string;
  readOnly?: boolean;
};

// Componente controlado: clicar na imagem adiciona um pino numerado (coord em %),
// clicar num pino remove. Abaixo, um campo de notas livre.
export function BodyMapInput({ src, markers, notes, onChange, hint, notesPlaceholder, clearLabel, readOnly }: InputProps) {
  const ref = useRef<HTMLDivElement>(null);

  function addMarker(e: React.MouseEvent<HTMLDivElement>) {
    if (readOnly || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    onChange([...markers, { x, y }], notes);
  }

  function removeMarker(i: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (readOnly) return;
    onChange(markers.filter((_, idx) => idx !== i), notes);
  }

  if (!src) {
    return (
      <textarea
        value={notes}
        onChange={(e) => onChange(markers, e.target.value)}
        rows={3}
        placeholder={notesPlaceholder}
        className="w-full resize-none rounded-[8px] border border-black/[.12] px-[10px] py-[8px] text-[13px] outline-none focus:border-[#0F6E56] transition"
      />
    );
  }

  return (
    <div className="space-y-[8px]">
      {!readOnly && <p className="text-[11px] text-[#A09E98]">{hint}</p>}
      <div
        ref={ref}
        onClick={addMarker}
        className={`relative inline-block max-w-full rounded-[10px] border border-black/[.10] overflow-hidden ${readOnly ? "" : "cursor-crosshair"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="block w-full max-w-[340px] select-none" draggable={false} />
        {markers.map((m, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => removeMarker(i, e)}
            title={readOnly ? undefined : clearLabel}
            className="absolute -translate-x-1/2 -translate-y-1/2 h-[22px] w-[22px] rounded-full bg-[#C0392B] text-white text-[11px] font-semibold flex items-center justify-center border-2 border-white shadow"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => onChange(markers, e.target.value)}
        rows={2}
        placeholder={notesPlaceholder}
        className="w-full resize-none rounded-[8px] border border-black/[.12] px-[10px] py-[8px] text-[12px] outline-none focus:border-[#0F6E56] transition"
      />
    </div>
  );
}

type FieldProps = {
  name: string;
  src: string | null;
  defaultValue?: string | null;
  hint: string;
  notesPlaceholder: string;
  clearLabel: string;
};

function parseValue(raw: string | null | undefined): { markers: BodyMapMarker[]; notes: string } {
  if (!raw) return { markers: [], notes: "" };
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object" && Array.isArray(v.markers)) {
      return {
        markers: v.markers.filter((m: unknown) => m && typeof (m as BodyMapMarker).x === "number"),
        notes: typeof v.notes === "string" ? v.notes : "",
      };
    }
  } catch {
    // valor legado em texto puro → vira nota
    return { markers: [], notes: raw };
  }
  return { markers: [], notes: "" };
}

// Wrapper para formulários (uncontrolled): mantém estado e grava JSON num hidden input.
export function BodyMapField({ name, src, defaultValue, hint, notesPlaceholder, clearLabel }: FieldProps) {
  const init = parseValue(defaultValue);
  const [markers, setMarkers] = useState<BodyMapMarker[]>(init.markers);
  const [notes, setNotes] = useState(init.notes);

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify({ markers, notes })} />
      <BodyMapInput
        src={src}
        markers={markers}
        notes={notes}
        onChange={(m, n) => { setMarkers(m); setNotes(n); }}
        hint={hint}
        notesPlaceholder={notesPlaceholder}
        clearLabel={clearLabel}
      />
    </div>
  );
}
