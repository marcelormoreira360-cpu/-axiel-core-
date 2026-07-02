"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Send, Users, X, ChevronDown, CheckCircle2, XCircle,
  AlertCircle, Megaphone, Eye, EyeOff,
} from "lucide-react";

type Segment = "all_active" | "inactive_30" | "inactive_60";

const SEGMENTS: { value: Segment; labelKey: string; descKey: string }[] = [
  { value: "all_active", labelKey: "segAllActiveLabel", descKey: "segAllActiveDesc" },
  { value: "inactive_30", labelKey: "segInactive30Label", descKey: "segInactive30Desc" },
  { value: "inactive_60", labelKey: "segInactive60Label", descKey: "segInactive60Desc" },
];

type Step = "compose" | "preview" | "sending" | "done";

interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  failedNames: string[];
}

function applyVars(msg: string, name = "Maria") {
  return msg
    .replace(/{{nome}}/gi, name)
    .replace(/{{nome_completo}}/gi, name + " Silva");
}

export function BroadcastWhatsAppModal() {
  const t = useTranslations("automations.broadcast");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("compose");
  const [segment, setSegment] = useState<Segment>("inactive_30");
  const [segmentOpen, setSegmentOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Fetch recipient count whenever segment changes
  useEffect(() => {
    if (!open) return;
    setCount(null);
    setLoadingCount(true);
    fetch(`/api/automacoes/broadcast?segment=${segment}`)
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => setCount(null))
      .finally(() => setLoadingCount(false));
  }, [segment, open]);

  function reset() {
    setStep("compose");
    setSegment("inactive_30");
    setTitle("");
    setMessage("");
    setCount(null);
    setResult(null);
    setError(null);
    setShowPreview(false);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(reset, 300);
  }

  async function handleSend() {
    if (!message.trim() || count === 0) return;
    setStep("sending");
    setError(null);

    try {
      const res = await fetch("/api/automacoes/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, title, messageBody: message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("errSend"));
        setStep("compose");
        return;
      }
      setResult(data as BroadcastResult);
      setStep("done");
    } catch {
      setError(t("errConn"));
      setStep("compose");
    }
  }

  function insertVar(v: string) {
    const el = textRef.current;
    if (!el) { setMessage((m) => m + v); return; }
    const start = el.selectionStart ?? message.length;
    const end   = el.selectionEnd ?? message.length;
    const next  = message.slice(0, start) + v + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + v.length, start + v.length);
    });
  }

  const selectedSeg = SEGMENTS.find((s) => s.value === segment)!;
  const canSend = message.trim().length >= 5 && count !== null && count > 0 && step === "compose";

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(true); reset(); }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#0F6E56] text-white text-[13px] font-medium hover:bg-[#085041] transition"
      >
        <Megaphone className="w-4 h-4" />
        {t("trigger")}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="bg-white dark:bg-[#161B26] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[.06] dark:border-white/[.08]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[8px] bg-[#25D366] flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.116 1.527 5.843L.054 23.486a.5.5 0 0 0 .611.612l5.65-1.474A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.892 0-3.66-.5-5.187-1.376l-.371-.214-3.854 1.005 1.027-3.735-.232-.382A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                </div>
                <h2 className="text-[15px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">
                  {step === "done" ? t("headerDone") : t("header")}
                </h2>
              </div>
              <button onClick={handleClose} aria-label={t("close")} className="text-[#A09E98] hover:text-[#6B6A66] dark:hover:text-[#9E9C97] transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Sending state ── */}
            {step === "sending" && (
              <div className="flex flex-col items-center justify-center py-16 px-6 gap-4">
                <div className="w-12 h-12 rounded-full border-[3px] border-[#0F6E56]/20 border-t-[#0F6E56] animate-spin" />
                <p className="text-[14px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{t("sending")}</p>
                <p className="text-[12px] text-[#A09E98] text-center">
                  {t("sendingNote")}
                </p>
              </div>
            )}

            {/* ── Done state ── */}
            {step === "done" && result && (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-[#E1F5EE] dark:bg-[#0F6E56]/20 rounded-[12px]">
                  <CheckCircle2 className="w-6 h-6 text-[#0F6E56] dark:text-[#9FE1CB] shrink-0" />
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">
                      {t("doneSummary", { sent: result.sent, total: result.total })}
                    </p>
                    {result.failed > 0 && (
                      <p className="text-[12px] text-[#6B6A66] dark:text-[#9E9C97] mt-[2px]">
                        {t("doneFailed", { failed: result.failed })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: t("statTotal"), value: result.total, color: "#0F1A2E" },
                    { label: t("statSent"), value: result.sent, color: "#0F6E56" },
                    { label: t("statFailed"), value: result.failed, color: result.failed > 0 ? "#EB5757" : "#A09E98" },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#F8F7F4] dark:bg-white/[.04] rounded-[10px] p-3 text-center">
                      <p className="text-[20px] font-semibold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] text-[#A09E98] mt-[2px] uppercase tracking-wide">{s.label}</p>
                    </div>
                  ))}
                </div>

                {result.failedNames.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/10 rounded-[10px] p-3">
                    <p className="text-[11px] font-semibold text-red-600 mb-1">{t("failures")}</p>
                    <p className="text-[11px] text-red-500">{result.failedNames.slice(0, 5).join(", ")}{result.failedNames.length > 5 ? ` +${result.failedNames.length - 5}` : ""}</p>
                  </div>
                )}

                <button
                  onClick={handleClose}
                  className="w-full h-10 rounded-[10px] bg-[#0F1A2E] text-white text-[13px] font-medium hover:bg-[#1a2d4a] transition"
                >
                  {t("close")}
                </button>
              </div>
            )}

            {/* ── Compose state ── */}
            {(step === "compose" || step === "sending") && step !== "sending" && (
              <div className="p-5 space-y-4">
                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/10 rounded-[8px] text-[12px] text-red-500">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">
                    {t("campaignName")}
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("campaignPlaceholder")}
                    className="w-full h-9 px-3 rounded-[8px] border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#1C2333] text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] placeholder:text-[#A09E98] focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/30"
                  />
                </div>

                {/* Segment picker */}
                <div className="relative">
                  <label className="block text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[6px]">
                    {t("recipients")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setSegmentOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-[8px] border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#1C2333] text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] hover:border-black/20 dark:hover:border-white/20 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#A09E98]" />
                      {t(selectedSeg.labelKey)}
                      {count !== null && (
                        <span className="text-[11px] px-[6px] py-[1px] rounded-full bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#0F6E56] dark:text-[#9FE1CB] font-medium">
                          {loadingCount ? "…" : t("patientsCount", { count })}
                        </span>
                      )}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[#A09E98] transition ${segmentOpen ? "rotate-180" : ""}`} />
                  </button>

                  {segmentOpen && (
                    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white dark:bg-[#1C2333] border border-black/[.08] dark:border-white/[.1] rounded-[10px] shadow-lg overflow-hidden">
                      {SEGMENTS.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => { setSegment(s.value); setSegmentOpen(false); }}
                          className={`w-full text-left px-3 py-3 hover:bg-[#F8F7F4] dark:hover:bg-white/[.04] transition ${s.value === segment ? "bg-[#F0FAF6] dark:bg-[#0F6E56]/10" : ""}`}
                        >
                          <p className={`text-[13px] font-medium ${s.value === segment ? "text-[#0F6E56] dark:text-[#9FE1CB]" : "text-[#0F1A2E] dark:text-[#E8E6E2]"}`}>
                            {t(s.labelKey)}
                          </p>
                          <p className="text-[11px] text-[#A09E98] mt-[1px]">{t(s.descKey)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Message composer */}
                <div>
                  <div className="flex items-center justify-between mb-[6px]">
                    <label className="text-[11px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">
                      {t("message")}
                    </label>
                    <span className="text-[11px] text-[#A09E98]">{message.length}/1000</span>
                  </div>

                  <textarea
                    ref={textRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={1000}
                    rows={5}
                    placeholder={t("msgPlaceholder")}
                    className="w-full px-3 py-2.5 rounded-[8px] border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#1C2333] text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] placeholder:text-[#A09E98] focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/30 resize-none leading-relaxed"
                  />

                  {/* Variable chips */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] text-[#A09E98]">{t("insert")}</span>
                    {["{{nome}}", "{{nome_completo}}"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertVar(v)}
                        className="text-[11px] px-2 py-[2px] rounded-md bg-[#F4F3EF] dark:bg-white/[.06] text-[#6B6A66] dark:text-[#9E9C97] hover:bg-[#E8E6E2] dark:hover:bg-white/[.08] transition font-mono"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview toggle */}
                {message.trim() && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPreview((v) => !v)}
                      className="inline-flex items-center gap-1 text-[12px] text-[#0F6E56] dark:text-[#9FE1CB] hover:underline"
                    >
                      {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showPreview ? t("previewHide") : t("previewShow")}
                    </button>

                    {showPreview && (
                      <div className="mt-2 bg-[#E1F5EE] dark:bg-[#0F6E56]/20 rounded-[10px] px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#0F6E56] dark:text-[#9FE1CB] mb-2">{t("previewHow")}</p>
                        <div className="bg-white dark:bg-[#111827] rounded-[8px] px-3 py-2 shadow-sm">
                          <p className="text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] whitespace-pre-wrap leading-relaxed">
                            {applyVars(message)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Warning */}
                {count === 0 && !loadingCount && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/10 rounded-[8px] text-[12px] text-amber-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {t("noPatients")}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={handleClose}
                    className="text-[13px] text-[#A09E98] hover:text-[#6B6A66] dark:hover:text-[#9E9C97] transition"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!canSend}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#0F6E56] text-white text-[13px] font-medium hover:bg-[#085041] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    {t("sendTo", { count: count ?? "…" })}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
