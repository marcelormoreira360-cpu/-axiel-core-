"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";

interface NpsWidgetProps {
  appointmentId: string;
  sessionDate: string;
  rawToken: string;
  brandColor: string;
  onSubmit: () => void;
}

// Returns a Tailwind-compatible inline style for the score button background
function scoreColor(score: number, selected: boolean): string {
  if (!selected) return "";
  if (score <= 6) return "#E53E3E"; // red — detractor
  if (score <= 8) return "#D97706"; // amber — passive
  return "#0F6E56";                  // green — promoter
}

function scoreLabelKey(score: number): string {
  if (score <= 6) return "scoreLow";
  if (score <= 8) return "scoreMid";
  return "scoreHigh";
}

export function NpsWidget({
  appointmentId,
  sessionDate,
  rawToken,
  brandColor,
  onSubmit,
}: NpsWidgetProps) {
  const t = useTranslations("portal.nps");
  const locale = useLocale();
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateLabel = new Date(sessionDate).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function handleSubmit() {
    if (selected === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/p/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: rawToken,
          appointment_id: appointmentId,
          nps_score: selected,
          feedback_text: text.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("errSubmit"));
        return;
      }
      onSubmit();
    } catch {
      setError(t("errConn"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">
          {t("title")}
        </p>
        <p className="mt-1 text-sm text-[#0F1A2E] capitalize">{dateLabel}</p>
      </div>

      <div>
        <p className="text-xs text-black/50 mb-2">
          {t("question")}
        </p>

        {/* Score buttons: 0-10 */}
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: 11 }, (_, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className="h-9 w-9 rounded-xl text-sm font-semibold transition border"
                style={
                  isSelected
                    ? { backgroundColor: scoreColor(i, true), color: "#fff", borderColor: "transparent" }
                    : { color: "#0F1A2E", borderColor: "rgba(0,0,0,0.10)" }
                }
              >
                {i}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <p className="mt-2 text-xs font-medium" style={{ color: scoreColor(selected, true) }}>
            {t(scoreLabelKey(selected))}
          </p>
        )}
      </div>

      {/* Optional comment */}
      {selected !== null && (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("commentPlaceholder")}
            rows={2}
            maxLength={1000}
            className="w-full text-sm text-[#0F1A2E] bg-[#F8FAF9] border border-black/[.08] rounded-xl px-3 py-2 resize-none outline-none focus:border-black/20 transition placeholder:text-black/30"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={selected === null || submitting}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: brandColor }}
        >
          {submitting ? t("sending") : t("submit")}
        </button>
        <button
          onClick={onSubmit}
          className="text-xs text-black/35 hover:text-black/50 transition"
        >
          {t("notNow")}
        </button>
      </div>
    </div>
  );
}
