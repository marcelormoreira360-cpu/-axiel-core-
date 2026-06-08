"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import type { BodyMapMarker } from "@/lib/types";

const LEVEL_COLORS: Record<number, string> = { 1: "#0F6E56", 2: "#D97A1A", 3: "#C0392B" };
const LEVELS: (1 | 2 | 3)[] = [1, 2, 3];

function colorFor(m: BodyMapMarker) {
  return LEVEL_COLORS[m.intensity ?? 2];
}

type InputProps = {
  src: string | null;
  markers: BodyMapMarker[];
  notes: string;
  onChange: (markers: BodyMapMarker[], notes: string) => void;
  readOnly?: boolean;
};

export function BodyMapInput({ src, markers, notes, onChange, readOnly }: InputProps) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const moved = useRef(false);

  const levelLabel = (lvl: number) =>
    lvl === 1 ? t("bodyMap.levelMild") : lvl === 3 ? t("bodyMap.levelSevere") : t("bodyMap.levelModerate");

  function coords(e: { clientX: number; clientY: number }) {
    const rect = ref.current!.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10));
    const y = Math.min(100, Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10));
    return { x, y };
  }

  function addMarker(e: React.PointerEvent<HTMLDivElement>) {
    if (readOnly || !ref.current) return;
    const { x, y } = coords(e);
    onChange([...markers, { x, y, intensity: 2, label: "" }], notes);
  }

  function update(i: number, patch: Partial<BodyMapMarker>) {
    onChange(markers.map((m, idx) => (idx === i ? { ...m, ...patch } : m)), notes);
  }
  function remove(i: number) {
    onChange(markers.filter((_, idx) => idx !== i), notes);
  }

  function pinDown(i: number, e: React.PointerEvent) {
    if (readOnly) return;
    e.stopPropagation();
    dragging.current = i;
    moved.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function pinMove(i: number, e: React.PointerEvent) {
    if (dragging.current !== i || !ref.current) return;
    moved.current = true;
    update(i, coords(e));
  }
  function pinUp(i: number, e: React.PointerEvent) {
    if (dragging.current === i) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      dragging.current = null;
    }
  }

  return (
    <div className="space-y-[10px]">
      {src ? (
        <>
          {!readOnly && <p className="text-[11px] text-[#A09E98]">{t("bodyMap.hint")}</p>}
          <div
            ref={ref}
            onPointerDown={addMarker}
            className={`relative inline-block max-w-full rounded-[10px] border border-black/[.10] overflow-hidden ${readOnly ? "" : "cursor-crosshair touch-none"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="block w-full max-w-[340px] select-none" draggable={false} />
            {markers.map((m, i) => (
              <button
                key={i}
                type="button"
                onPointerDown={(e) => pinDown(i, e)}
                onPointerMove={(e) => pinMove(i, e)}
                onPointerUp={(e) => pinUp(i, e)}
                className="absolute -translate-x-1/2 -translate-y-1/2 h-[24px] w-[24px] rounded-full text-white text-[11px] font-semibold flex items-center justify-center border-2 border-white shadow touch-none"
                style={{ left: `${m.x}%`, top: `${m.y}%`, backgroundColor: colorFor(m), cursor: readOnly ? "default" : "grab" }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* Lista de pontos: intensidade + descrição */}
      {markers.length > 0 && (
        <div className="space-y-[6px]">
          {markers.map((m, i) => (
            <div key={i} className="flex items-center gap-[6px] bg-[#FAFAF8] rounded-[8px] px-[8px] py-[6px]">
              <span
                className="h-[20px] w-[20px] shrink-0 rounded-full text-white text-[10px] font-semibold flex items-center justify-center"
                style={{ backgroundColor: colorFor(m) }}
              >
                {i + 1}
              </span>
              {!readOnly && (
                <div className="flex gap-[2px] shrink-0">
                  {LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => update(i, { intensity: lvl })}
                      title={levelLabel(lvl)}
                      className="h-[18px] w-[18px] rounded-full border"
                      style={{
                        backgroundColor: (m.intensity ?? 2) === lvl ? LEVEL_COLORS[lvl] : "transparent",
                        borderColor: LEVEL_COLORS[lvl],
                      }}
                      aria-label={levelLabel(lvl)}
                    />
                  ))}
                </div>
              )}
              <input
                type="text"
                value={m.label ?? ""}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder={t("bodyMap.pointNote")}
                disabled={readOnly}
                className="flex-1 min-w-0 px-[8px] py-[5px] rounded-[6px] border border-black/[.10] text-[12px] outline-none focus:border-[#0F6E56] transition disabled:bg-transparent disabled:border-transparent"
              />
              {!readOnly && (
                <button type="button" onClick={() => remove(i)} title={t("bodyMap.remove")} className="w-6 h-6 flex items-center justify-center rounded text-[#A09E98] hover:text-red-500 shrink-0">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <textarea
        value={notes}
        onChange={(e) => onChange(markers, e.target.value)}
        rows={2}
        disabled={readOnly}
        placeholder={t("bodyMap.notesPlaceholder")}
        className="w-full resize-none rounded-[8px] border border-black/[.12] px-[10px] py-[8px] text-[12px] outline-none focus:border-[#0F6E56] transition disabled:bg-transparent"
      />
    </div>
  );
}

type FieldProps = {
  name: string;
  src: string | null;
  defaultValue?: string | null;
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
    return { markers: [], notes: raw };
  }
  return { markers: [], notes: "" };
}

// Wrapper para formulários: mantém estado e grava JSON num hidden input.
export function BodyMapField({ name, src, defaultValue }: FieldProps) {
  const init = parseValue(defaultValue);
  const [markers, setMarkers] = useState<BodyMapMarker[]>(init.markers);
  const [notes, setNotes] = useState(init.notes);

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify({ markers, notes })} />
      <BodyMapInput src={src} markers={markers} notes={notes} onChange={(m, n) => { setMarkers(m); setNotes(n); }} />
    </div>
  );
}
