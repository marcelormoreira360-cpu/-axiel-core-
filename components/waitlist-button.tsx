"use client";

import { useState } from "react";
import { Clock, CheckCircle2, X } from "lucide-react";

interface Props {
  patientId: string;
  patientName: string;
  isOnWaitlist: boolean;
  waitlistEntryId?: string | null;
}

export function WaitlistButton({ patientId, patientName, isOnWaitlist, waitlistEntryId }: Props) {
  const [onList, setOnList] = useState(isOnWaitlist);
  const [entryId, setEntryId] = useState(waitlistEntryId ?? null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAdd() {
    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      const data = await res.json();
      if (data.ok) {
        setOnList(true);
        setEntryId(data.id);
        setDone(true);
        setTimeout(() => setDone(false), 2500);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!entryId) return;
    setLoading(true);
    try {
      await fetch(`/api/waitlist/${entryId}`, { method: "DELETE" });
      setOnList(false);
      setEntryId(null);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#E1F5EE] text-[#0F6E56] text-[12px] font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {patientName.split(" ")[0]} adicionado à fila
      </div>
    );
  }

  if (onList) {
    return (
      <button
        onClick={handleRemove}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-amber-50 dark:bg-amber-900/10 text-amber-700 text-[12px] font-medium hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50 group"
        title="Remover da fila de espera"
      >
        <Clock className="w-3.5 h-3.5 group-hover:hidden" />
        <X className="w-3.5 h-3.5 hidden group-hover:block" />
        <span className="group-hover:hidden">Na fila de espera</span>
        <span className="hidden group-hover:block">Remover da fila</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#1C2333] text-[#6B6A66] text-[12px] font-medium hover:border-[#0F6E56]/30 hover:text-[#0F6E56] hover:bg-[#F0FAF6] transition disabled:opacity-50"
    >
      <Clock className="w-3.5 h-3.5" />
      {loading ? "Adicionando…" : "Fila de espera"}
    </button>
  );
}
