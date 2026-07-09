"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

interface Props {
  zoomJoinUrl: string;
  zoomStartUrl?: string | null;
  startsAt: string;
  patientName: string;
}

function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export function ZoomSessionBanner({ zoomJoinUrl, zoomStartUrl, startsAt, patientName }: Props) {
  const t = useTranslations("teleconsulta.zoomBanner");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  async function copyJoinUrl() {
    try {
      await navigator.clipboard.writeText(zoomJoinUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = zoomJoinUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const isUpcoming = new Date(startsAt).getTime() > Date.now() - 30 * 60 * 1000;

  return (
    <div className="bg-[#1E3A5F] border border-[#2D8CFF]/30 rounded-[14px] overflow-hidden mb-5">
      {/* Header bar */}
      <div className="flex items-center justify-between px-[16px] py-[11px] border-b border-white/[.07]">
        <div className="flex items-center gap-[8px]">
          {/* Zoom icon */}
          <div className="w-7 h-7 rounded-[7px] bg-[#2D8CFF] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M15 10.5V8.25A2.25 2.25 0 0012.75 6H4.5A2.25 2.25 0 002.25 8.25v7.5A2.25 2.25 0 004.5 18h8.25A2.25 2.25 0 0015 15.75V13.5l4.72 3.15A.75.75 0 0021 16.02V7.98a.75.75 0 00-1.28-.53L15 10.5z"/>
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white">{t("title")}</p>
            <p className="text-[10px] text-white/50 capitalize">
              {t("dateAt", { date: fmtDate(startsAt, locale), time: fmtTime(startsAt, locale), name: patientName })}
            </p>
          </div>
        </div>
        {isUpcoming && (
          <span className="text-[10px] font-medium bg-[#2D8CFF]/20 text-[#93C5FD] px-[8px] py-[3px] rounded-full">
            {t("soon")}
          </span>
        )}
      </div>

      {/* Links */}
      <div className="px-[16px] py-[12px] flex flex-wrap gap-[8px]">
        {/* Host link */}
        {zoomStartUrl && (
          <a
            href={zoomStartUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#2D8CFF] hover:bg-[#1a7aee] px-[14px] py-[8px] rounded-[8px] transition"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            {t("joinAsHost")}
          </a>
        )}

        {/* Patient join link */}
        <div className="flex items-center gap-[6px] bg-white/[.07] rounded-[8px] px-[10px] py-[7px] flex-1 min-w-[180px]">
          <span className="text-[10px] text-white/40 shrink-0">{t("patientLink")}</span>
          <span className="text-[11px] text-white/60 font-mono truncate flex-1">
            {zoomJoinUrl.replace(/^https?:\/\//, "").slice(0, 32)}…
          </span>
          <button
            type="button"
            onClick={copyJoinUrl}
            className={[
              "flex items-center gap-[4px] text-[11px] font-medium rounded-[6px] px-[8px] py-[4px] transition shrink-0",
              copied
                ? "bg-[#0F6E56]/30 text-[#6EE7C0]"
                : "bg-white/[.10] text-white/60 hover:bg-white/[.18]",
            ].join(" ")}
          >
            {copied ? (
              <>
                <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                  <path d="M2 7L5 10L11 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t("copied")}
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                  <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M1 9V2a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {t("copy")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
