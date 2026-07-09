"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type PatientRef = { full_name: string; email: string | null; phone: string | null };

type Request = {
  id: string;
  status: string;
  reason: string | null;
  requested_at: string;
  reviewed_at: string | null;
  // Supabase join returns array when using FK select
  patients: PatientRef | PatientRef[] | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "#F59E0B",
  in_review: "#3B82F6",
  completed: "#0F6E56",
  rejected:  "#EF4444",
};

export function LgpdRequestsClient({ requests: initial, clinicId }: { requests: Request[]; clinicId: string }) {
  const t = useTranslations("settings.lgpd");
  const locale = useLocale();
  const [requests, setRequests] = useState(initial);
  const [, startTransition] = useTransition();

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  }

  async function updateStatus(id: string, status: string) {
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from("data_deletion_requests")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status, reviewed_at: new Date().toISOString() } : r));
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white border border-black/[.07] rounded-2xl p-12 text-center">
        <p className="text-[13px] text-black/40">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => {
        const patient = Array.isArray(req.patients) ? req.patients[0] : req.patients;
        const st = {
          label: req.status in STATUS_COLORS
            ? t(`status.${req.status as "pending" | "in_review" | "completed" | "rejected"}`)
            : req.status,
          color: STATUS_COLORS[req.status] ?? "#6B7280",
        };
        return (
          <div key={req.id} className="bg-white border border-black/[.07] rounded-2xl px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[14px] font-semibold text-[#0F1A2E] truncate">
                    {patient?.full_name ?? t("unknownPatient")}
                  </p>
                  <span
                    className="shrink-0 text-[10px] font-semibold uppercase tracking-[.08em] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${st.color}18`, color: st.color }}
                  >
                    {st.label}
                  </span>
                </div>
                {patient?.email && <p className="text-[12px] text-black/40">{patient.email}</p>}
                {req.reason && (
                  <p className="text-[12px] text-black/60 mt-1 italic">“{req.reason}”</p>
                )}
                <p className="text-[11px] text-black/30 mt-1">
                  {t("requestedAt", { date: formatDate(req.requested_at) })}
                  {req.reviewed_at && ` · ${t("reviewedAt", { date: formatDate(req.reviewed_at) })}`}
                </p>
              </div>
              {req.status === "pending" && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startTransition(() => updateStatus(req.id, "in_review"))}
                    className="text-[11px] font-medium text-[#3B82F6] border border-[#3B82F6]/30 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"
                  >
                    {t("review")}
                  </button>
                  <button
                    onClick={() => startTransition(() => updateStatus(req.id, "completed"))}
                    className="text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] px-3 py-1.5 rounded-lg transition"
                  >
                    {t("complete")}
                  </button>
                  <button
                    onClick={() => startTransition(() => updateStatus(req.id, "rejected"))}
                    className="text-[11px] font-medium text-red-500 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                  >
                    {t("reject")}
                  </button>
                </div>
              )}
              {req.status === "in_review" && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startTransition(() => updateStatus(req.id, "completed"))}
                    className="text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] px-3 py-1.5 rounded-lg transition"
                  >
                    {t("complete")}
                  </button>
                  <button
                    onClick={() => startTransition(() => updateStatus(req.id, "rejected"))}
                    className="text-[11px] font-medium text-red-500 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
                  >
                    {t("reject")}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
