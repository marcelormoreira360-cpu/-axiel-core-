"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clock, CheckCircle2, X } from "lucide-react";

interface Props {
  patientId: string;
  patientName: string;
  isOnWaitlist: boolean;
  waitlistEntryId?: string | null;
}

export function WaitlistButton({ patientId, patientName, isOnWaitlist, waitlistEntryId }: Props) {
  const t = useTranslations("patientPanels.waitlist");
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
      <div
        className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg bg-[#E1F5EE] text-[#0F6E56]"
        title={t("added", { name: patientName.split(" ")[0] })}
      >
        <CheckCircle2 className="w-[15px] h-[15px]" />
      </div>
    );
  }

  if (onList) {
    return (
      <button
        onClick={handleRemove}
        disabled={loading}
        className="w-[30px] h-[30px] rounded-lg bg-amber-50 dark:bg-amber-900/10 text-amber-700 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50 group"
        title={t("onList")}
        aria-label={t("onList")}
      >
        <Clock className="w-[15px] h-[15px] group-hover:hidden" />
        <X className="w-[15px] h-[15px] hidden group-hover:block" />
      </button>
    );
  }

  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="w-[30px] h-[30px] rounded-lg border border-black/[.1] dark:border-white/[.1] bg-white dark:bg-[#1C2333] text-[#6B6A66] flex items-center justify-center hover:border-[#0F6E56]/30 hover:text-[#0F6E56] hover:bg-[#F0FAF6] transition disabled:opacity-50"
      title={loading ? t("adding") : t("add")}
      aria-label={t("add")}
    >
      <Clock className="w-[15px] h-[15px]" />
    </button>
  );
}
