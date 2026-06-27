"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  reorderPatientSectionsAction,
  togglePatientSectionVisibilityAction,
} from "@/app/settings/secoes/actions";
import type { ClinicPatientSection } from "@/lib/types";

type T = (k: string) => string;

function SortableRow({ s, t, onToggle }: { s: ClinicPatientSection; t: T; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border border-black/[.07] rounded-[10px] px-3 py-2.5 flex items-center gap-2 bg-white ${isDragging ? "shadow-md" : ""} ${s.is_visible ? "" : "opacity-70"}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-[#C4C2BC] hover:text-[#6B6A66] touch-none p-0.5"
        title={t("drag")}
        aria-label={t("drag")}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className={`text-[13px] font-medium ${s.is_visible ? "text-[#0F1A2E]" : "text-[#A09E98]"}`}>
          {t(`labels.${s.section_key}`)}
        </span>
        {!s.is_visible && (
          <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">{t("hidden")}</span>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[#6B6A66] hover:text-[#0F6E56] border border-black/[.08] rounded-[8px] px-[10px] py-[5px] transition"
        title={s.is_visible ? t("hide") : t("show")}
      >
        {s.is_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        {s.is_visible ? t("hide") : t("show")}
      </button>
    </div>
  );
}

export function PatientSectionsForm({ initial }: { initial: ClinicPatientSection[] }) {
  const t = useTranslations("settings.patientSections");
  const [items, setItems] = useState(initial);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // otimista: a UI muda já; o servidor persiste a ordem nova
    reorderPatientSectionsAction(next.map((i) => i.id));
  }

  function toggle(s: ClinicPatientSection) {
    const nextVisible = !s.is_visible;
    setItems((prev) => prev.map((i) => (i.id === s.id ? { ...i, is_visible: nextVisible } : i)));
    togglePatientSectionVisibilityAction(s.id, nextVisible);
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium text-[#6B6A66]">{t("listLabel")}</p>
      <p className="text-[11px] text-[#A09E98] mb-1">{t("dragHint")}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((s) => (
              <SortableRow key={s.id} s={s} t={t} onToggle={() => toggle(s)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
