"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Lead, LeadStage } from "@/lib/types";
import { groupLeadsByStage } from "@/modules/leads/lead-pipeline";

const knownSources = ["instagram", "google", "facebook", "website", "referral", "other"] as const;

function sourceKey(source: string) {
  return (knownSources as readonly string[]).includes(source) ? source : "other";
}

const stageColors: Record<LeadStage, { dot: string; badge: string }> = {
  new_lead:             { dot: "bg-[#0F6E56]",  badge: "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#085041] dark:text-[#9FE1CB]" },
  contacted:            { dot: "bg-[#0C447C]",  badge: "bg-[#E6F1FB] dark:bg-[#3B6BE4]/[.15] text-[#0C447C] dark:text-[#8FBFF5]" },
  scheduled:            { dot: "bg-[#633806]",  badge: "bg-[#FAEEDA] dark:bg-[#C77D17]/[.15] text-[#633806] dark:text-[#E8B04B]" },
  converted_to_patient: { dot: "bg-[#A09E98]",  badge: "bg-[#F4F3EF] text-[#6B6A66]" },
};

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function LeadCardContent({ lead, isSaving }: { lead: Lead; isSaving: boolean }) {
  const t = useTranslations("leads");
  const complaint = lead.main_complaint || lead.notes || "";

  return (
    <>
      <div className="flex items-center gap-[9px] mb-[7px]">
        <div className="w-7 h-7 rounded-full bg-[#F4F3EF] flex items-center justify-center text-[10px] font-medium text-[#6B6A66] shrink-0">
          {initials(lead.full_name)}
        </div>
        <p className="text-[13px] font-medium text-[#0F1A2E] truncate flex-1">{lead.full_name}</p>
        {isSaving && <span className="text-[10px] text-[#A09E98]">{t("pipeline.saving")}</span>}
      </div>

      {complaint && (
        <p className="text-[11px] text-[#6B6A66] leading-relaxed line-clamp-2 mb-[9px]">{complaint}</p>
      )}

      <div className="flex items-center gap-[6px]">
        <span className="text-[10px] px-[8px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">
          {t(`new.sourceOptions.${sourceKey(lead.source)}`)}
        </span>
        {lead.email && (
          <span className="text-[10px] text-[#A09E98] truncate">{lead.email}</span>
        )}
      </div>
    </>
  );
}

function DraggableLeadCard({
  lead,
  isSaving,
  suppressClickRef,
}: {
  lead: Lead;
  isSaving: boolean;
  suppressClickRef: React.MutableRefObject<boolean>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={[
        "bg-white border border-black/[.07] rounded-[10px] px-[13px] py-[11px]",
        "cursor-grab active:cursor-grabbing touch-pan-y select-none",
        "hover:border-black/[.14] dark:hover:border-white/[.14] hover:shadow-sm transition group",
        isDragging ? "opacity-40" : "",
      ].join(" ")}
    >
      <Link
        href={`/leads/${lead.id}`}
        draggable={false}
        onClick={(e) => {
          if (isDragging || suppressClickRef.current) e.preventDefault();
        }}
        className="block"
      >
        <LeadCardContent lead={lead} isSaving={isSaving} />
      </Link>
    </article>
  );
}

function DroppableColumn({
  column,
  savingLeadId,
  suppressClickRef,
}: {
  column: ReturnType<typeof groupLeadsByStage>[number];
  savingLeadId: string | null;
  suppressClickRef: React.MutableRefObject<boolean>;
}) {
  const t = useTranslations("leads");
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const colors = stageColors[column.id];

  return (
    <section
      ref={setNodeRef}
      className={[
        "rounded-[12px] border p-[12px] min-h-[400px] transition",
        isOver
          ? "border-[#0F6E56]/30 bg-[#F0FAF6] dark:bg-[#0F6E56]/[.10]"
          : "border-black/[.07] bg-[#F4F3EF]/60 dark:bg-white/[.04]",
      ].join(" ")}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-[12px]">
        <div className="flex items-center gap-[7px]">
          <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${colors.dot}`} />
          <span className="text-[12px] font-medium text-[#0F1A2E]">{t(column.shortTitleKey)}</span>
        </div>
        <span className={`text-[10px] px-[7px] py-[1px] rounded-full font-medium ${colors.badge}`}>
          {column.leads.length}
        </span>
      </div>

      {/* Lead cards */}
      <div className="space-y-[8px]">
        {column.leads.map((lead) => (
          <DraggableLeadCard
            key={lead.id}
            lead={lead}
            isSaving={savingLeadId === lead.id}
            suppressClickRef={suppressClickRef}
          />
        ))}

        {column.leads.length === 0 && (
          <div className="flex items-center justify-center h-[80px] rounded-[8px] border border-dashed border-black/[.10] dark:border-white/[.10]">
            <p className="text-[11px] text-[#A09E98]">{t("pipeline.dropHere")}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function LeadPipelineBoard({ leads }: { leads: Lead[] }) {
  const t = useTranslations("leads");
  const supabase = createSupabaseBrowserClient();
  const [items, setItems] = useState(leads);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const suppressClickRef = useRef(false);

  const columns = useMemo(() => groupLeadsByStage(items), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  async function moveLead(leadId: string, nextStage: LeadStage) {
    const previousItems = items;
    const lead = items.find((item) => item.id === leadId);
    if (!lead || lead.stage === nextStage) return;

    setMessage("");
    setSavingLeadId(leadId);
    setItems((current) =>
      current.map((item) => (item.id === leadId ? { ...item, stage: nextStage } : item))
    );

    const { error } = await supabase.from("leads").update({ stage: nextStage }).eq("id", leadId);
    setSavingLeadId(null);

    if (error) {
      setItems(previousItems);
      setMessage(t("pipeline.moveError"));
      return;
    }

    setMessage(t("pipeline.movedTo", { stage: t(`pipeline.stages.${nextStage}.title`) }));
  }

  function handleDragStart(e: DragStartEvent) {
    const lead = items.find((item) => item.id === String(e.active.id)) ?? null;
    setActiveLead(lead);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveLead(null);

    // Evita que o clique disparado logo após soltar o card navegue para o lead.
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    const { active, over } = e;
    if (!over) return;
    void moveLead(String(active.id), over.id as LeadStage);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveLead(null)}
    >
      <div className="space-y-3">
        {message && (
          <p className="text-[11px] text-[#6B6A66] bg-white border border-black/[.07] rounded-lg px-3 py-2 inline-block">
            {message}
          </p>
        )}

        <div className="grid grid-cols-2 gap-[10px] lg:grid-cols-4">
          {columns.map((column) => (
            <DroppableColumn
              key={column.id}
              column={column}
              savingLeadId={savingLeadId}
              suppressClickRef={suppressClickRef}
            />
          ))}
        </div>
      </div>

      {/* DragOverlay: ghost card while dragging */}
      <DragOverlay>
        {activeLead && (
          <article className="bg-white border border-[#0F6E56]/30 rounded-[10px] px-[13px] py-[11px] shadow-lg cursor-grabbing rotate-[1.5deg]">
            <LeadCardContent lead={activeLead} isSaving={savingLeadId === activeLead.id} />
          </article>
        )}
      </DragOverlay>
    </DndContext>
  );
}
