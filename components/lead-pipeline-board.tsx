"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Lead, LeadStage } from "@/lib/types";
import { groupLeadsByStage, leadStageLabels } from "@/modules/leads/lead-pipeline";

const sourceLabels: Record<string, string> = {
  instagram: "Instagram",
  google: "Google",
  facebook: "Facebook",
  website: "Website",
  referral: "Referral",
  other: "Other",
};

const stageColors: Record<LeadStage, { dot: string; badge: string }> = {
  new_lead:             { dot: "bg-[#0F6E56]",  badge: "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#085041] dark:text-[#9FE1CB]" },
  contacted:            { dot: "bg-[#0C447C]",  badge: "bg-[#E6F1FB] dark:bg-[#3B6BE4]/[.15] text-[#0C447C] dark:text-[#8FBFF5]" },
  scheduled:            { dot: "bg-[#633806]",  badge: "bg-[#FAEEDA] dark:bg-[#C77D17]/[.15] text-[#633806] dark:text-[#E8B04B]" },
  converted_to_patient: { dot: "bg-[#A09E98]",  badge: "bg-[#F4F3EF] text-[#6B6A66]" },
};

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function LeadCard({
  lead,
  savingLeadId,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead;
  savingLeadId: string | null;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const complaint = lead.main_complaint || lead.notes || "";
  const source = sourceLabels[lead.source] ?? "Other";
  const isSaving = savingLeadId === lead.id;

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="bg-white border border-black/[.07] rounded-[10px] px-[13px] py-[11px] cursor-grab active:cursor-grabbing hover:border-black/[.14] dark:hover:border-white/[.14] hover:shadow-sm transition group"
    >
      <Link href={`/leads/${lead.id}`} className="block">
        <div className="flex items-center gap-[9px] mb-[7px]">
          <div className="w-7 h-7 rounded-full bg-[#F4F3EF] flex items-center justify-center text-[10px] font-medium text-[#6B6A66] shrink-0">
            {initials(lead.full_name)}
          </div>
          <p className="text-[13px] font-medium text-[#0F1A2E] truncate flex-1">{lead.full_name}</p>
          {isSaving && <span className="text-[10px] text-[#A09E98]">Saving…</span>}
        </div>

        {complaint && (
          <p className="text-[11px] text-[#6B6A66] leading-relaxed line-clamp-2 mb-[9px]">{complaint}</p>
        )}

        <div className="flex items-center gap-[6px]">
          <span className="text-[10px] px-[8px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">
            {source}
          </span>
          {lead.email && (
            <span className="text-[10px] text-[#A09E98] truncate">{lead.email}</span>
          )}
        </div>
      </Link>
    </article>
  );
}

export function LeadPipelineBoard({ leads }: { leads: Lead[] }) {
  const supabase = createSupabaseBrowserClient();
  const [items, setItems] = useState(leads);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<LeadStage | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const columns = useMemo(() => groupLeadsByStage(items), [items]);

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
      setMessage("Could not move this lead. Try again.");
      return;
    }

    setMessage(`Moved to ${leadStageLabels[nextStage]}.`);
  }

  return (
    <div className="space-y-3">
      {message && (
        <p className="text-[11px] text-[#6B6A66] bg-white border border-black/[.07] rounded-lg px-3 py-2 inline-block">
          {message}
        </p>
      )}

      <div className="grid grid-cols-4 gap-[10px]">
        {columns.map((column) => {
          const isActive = activeColumn === column.id;
          const colors = stageColors[column.id];

          return (
            <section
              key={column.id}
              onDragOver={(e) => { e.preventDefault(); setActiveColumn(column.id); }}
              onDragLeave={() => setActiveColumn(null)}
              onDrop={() => {
                if (draggedLeadId) void moveLead(draggedLeadId, column.id);
                setDraggedLeadId(null);
                setActiveColumn(null);
              }}
              className={[
                "rounded-[12px] border p-[12px] min-h-[400px] transition",
                isActive
                  ? "border-[#0F6E56]/30 bg-[#F0FAF6] dark:bg-[#0F6E56]/[.10]"
                  : "border-black/[.07] bg-[#F4F3EF]/60 dark:bg-white/[.04]",
              ].join(" ")}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-[12px]">
                <div className="flex items-center gap-[7px]">
                  <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${colors.dot}`} />
                  <span className="text-[12px] font-medium text-[#0F1A2E]">{column.shortTitle}</span>
                </div>
                <span className={`text-[10px] px-[7px] py-[1px] rounded-full font-medium ${colors.badge}`}>
                  {column.leads.length}
                </span>
              </div>

              {/* Lead cards */}
              <div className="space-y-[8px]">
                {column.leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    savingLeadId={savingLeadId}
                    onDragStart={() => setDraggedLeadId(lead.id)}
                    onDragEnd={() => { setDraggedLeadId(null); setActiveColumn(null); }}
                  />
                ))}

                {column.leads.length === 0 && (
                  <div className="flex items-center justify-center h-[80px] rounded-[8px] border border-dashed border-black/[.10] dark:border-white/[.10]">
                    <p className="text-[11px] text-[#A09E98]">Drop here</p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
