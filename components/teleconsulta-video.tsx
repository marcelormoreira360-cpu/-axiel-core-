"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface TeleconsultaVideoProps {
  appointmentId: string;
  patientName: string;
  displayName?: string;
}

type RoomState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

export function TeleconsultaVideo({ appointmentId, patientName, displayName }: TeleconsultaVideoProps) {
  const t = useTranslations("teleconsulta.video");
  const [room, setRoom] = useState<RoomState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function startRoom() {
    setRoom({ status: "loading" });
    try {
      const res = await fetch("/api/telehealth/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("errorCreate"));
      setRoom({ status: "ready", url: data.url });
    } catch (err) {
      setRoom({ status: "error", message: err instanceof Error ? err.message : t("errorUnknown") });
    }
  }

  /* ── Active call ──────────────────────────────────────────────── */
  if (room.status === "ready") {
    // Append display name via Daily prebuilt URL params
    const callUrl = displayName
      ? `${room.url}?userName=${encodeURIComponent(displayName)}`
      : room.url;

    return (
      <div className="relative h-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={callUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="w-full h-full border-0"
          title={t("frameTitle", { patient: patientName })}
        />

        {/* Top-right controls */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          {/* Copy patient link */}
          <button
            onClick={() => copyLink(room.url)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur text-[11px] font-medium text-white/70 hover:text-white hover:bg-black/80 transition"
            title={t("copyTitle")}
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M2 6.5l3.5 3.5 5.5-6" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-green-400">{t("copied")}</span>
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <rect x="4.5" y="4.5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M4.5 8.5H3a1 1 0 01-1-1V3a1 1 0 011-1h4.5a1 1 0 011 1v1.5" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
                {t("patientLink")}
              </>
            )}
          </button>

          {/* Close */}
          <button
            onClick={() => setRoom({ status: "idle" })}
            className="w-8 h-8 rounded-lg bg-black/60 backdrop-blur flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition"
            title={t("endVideo")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  /* ── Idle / loading / error ───────────────────────────────────── */
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 bg-[#0A0E14] rounded-xl p-8">

      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-white/[.06] flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M20 11H6a2 2 0 00-2 2v8a2 2 0 002 2h14a2 2 0 002-2v-8a2 2 0 00-2-2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M22 14l6-3v10l-6-3v-4z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </div>

      <div className="text-center">
        <p className="text-white text-[15px] font-medium mb-1">{t("withPatient", { patient: patientName })}</p>
        <p className="text-white/40 text-[12px]">
          {room.status === "idle" && t("clickToCreate")}
          {room.status === "loading" && t("creating")}
          {room.status === "error" && room.message}
        </p>
      </div>

      <button
        onClick={startRoom}
        disabled={room.status === "loading"}
        className="w-full max-w-xs flex items-center justify-center gap-2 text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 disabled:cursor-not-allowed transition px-4 py-3 rounded-xl"
      >
        {room.status === "loading" ? (
          <>
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="10"/>
            </svg>
            {t("wait")}
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 5.5H4a1.5 1.5 0 00-1.5 1.5v4a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V7a1.5 1.5 0 00-1.5-1.5z" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M11.5 7l3-1.5v5l-3-1.5V7z" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            {room.status === "error" ? t("retry") : t("start")}
          </>
        )}
      </button>

      <p className="text-white/25 text-[11px] text-center max-w-xs">
        A sala é criada no momento da consulta com link privado e expira em 3 horas.
      </p>
    </div>
  );
}
