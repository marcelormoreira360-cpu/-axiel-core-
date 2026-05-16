"use client";

import { useMemo, useState } from "react";
import { BODY_REGIONS, type BodyMapMark, type BodySide } from "@/modules/forms/body-map";
import { cn } from "@/lib/utils";

function BodyFigure({ side, selected, onToggle }: { side: BodySide; selected: string[]; onToggle: (regionId: string) => void }) {
  const regions = useMemo(() => BODY_REGIONS.filter((region) => region.side === side), [side]);

  return (
    <div className="rounded-2xl border border-axiel-line bg-white p-4">
      <p className="mb-3 text-center text-sm font-medium capitalize text-axiel-text-secondary">{side}</p>
      <div className="relative mx-auto h-72 max-w-[180px] rounded-[4rem] bg-axiel-background">
        <div className="absolute left-1/2 top-3 h-12 w-12 -translate-x-1/2 rounded-full border border-axiel-line bg-white" />
        <div className="absolute left-1/2 top-16 h-28 w-20 -translate-x-1/2 rounded-[2rem] border border-axiel-line bg-white" />
        <div className="absolute left-[35%] top-32 h-28 w-8 -translate-x-1/2 rounded-full border border-axiel-line bg-white" />
        <div className="absolute left-[65%] top-32 h-28 w-8 -translate-x-1/2 rounded-full border border-axiel-line bg-white" />
        {regions.map((region) => {
          const isSelected = selected.includes(region.id);
          return (
            <button
              key={region.id}
              type="button"
              aria-label={region.label}
              onClick={() => onToggle(region.id)}
              className={cn(
                "absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border text-[10px] transition",
                isSelected ? "border-axiel-primary bg-axiel-primary text-white shadow-sm" : "border-axiel-line bg-white text-axiel-text-secondary hover:border-axiel-primary"
              )}
              style={{ left: `${region.x}%`, top: `${region.y}%` }}
              title={region.label}
            >
              +
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BodyMapField({ name = "body_map_marks" }: { name?: string }) {
  const [marks, setMarks] = useState<BodyMapMark[]>([]);

  function toggle(regionId: string) {
    const region = BODY_REGIONS.find((item) => item.id === regionId);
    if (!region) return;

    setMarks((current) => {
      if (current.some((mark) => mark.body_region === regionId)) {
        return current.filter((mark) => mark.body_region !== regionId);
      }

      return [...current, { body_region: regionId, side: region.side, intensity: 5, note: "" }];
    });
  }

  function updateNote(regionId: string, note: string) {
    setMarks((current) => current.map((mark) => (mark.body_region === regionId ? { ...mark, note } : mark)));
  }

  const selected = marks.map((mark) => mark.body_region);

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(marks)} />

      <div className="grid gap-4 md:grid-cols-2">
        <BodyFigure side="front" selected={selected} onToggle={toggle} />
        <BodyFigure side="back" selected={selected} onToggle={toggle} />
      </div>

      <div className="rounded-2xl bg-axiel-background p-4">
        <p className="text-sm font-medium text-axiel-text-primary">Selected areas</p>
        {marks.length === 0 ? (
          <p className="mt-2 text-sm text-axiel-text-secondary">No area selected yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {marks.slice(0, 5).map((mark) => {
              const region = BODY_REGIONS.find((item) => item.id === mark.body_region);
              return (
                <label key={mark.body_region} className="block">
                  <span className="text-xs font-medium text-axiel-text-secondary">{region?.label ?? "Area of attention"}</span>
                  <input
                    className="mt-1 w-full rounded-xl border border-axiel-line bg-white px-3 py-2 text-sm outline-none focus:border-axiel-primary"
                    placeholder="Add a short note"
                    value={mark.note ?? ""}
                    onChange={(event) => updateNote(mark.body_region, event.target.value)}
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
