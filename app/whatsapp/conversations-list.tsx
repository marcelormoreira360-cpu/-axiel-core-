"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

// Linha de conversa já pronta (serializável) — montada no server (page.tsx).
export type ConvRowData = {
  id: string;
  url: string;
  phoneFormatted: string;
  channelLabel: string;
  status: "active" | "paused" | "with_team";
  statusLabel: string | null;
  isPatient: boolean;
  avatar: string;
  lastPrefix: "→" | "←" | "";
  lastText: string;
  timeAgo: string;
  msgCount: string;
  search: string; // string minúscula pré-computada p/ busca
};

type Filter = "all" | "with_team" | "active";

function Row({ row, patientBadge }: { row: ConvRowData; patientBadge: string }) {
  return (
    <Link
      href={row.url}
      className="flex items-center gap-[12px] px-[16px] py-[13px] hover:bg-[#FAFAF8] transition group"
    >
      <div
        className={[
          "w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-medium shrink-0",
          row.status === "paused"
            ? "bg-red-50 text-red-500"
            : row.status === "with_team"
            ? "bg-amber-50 text-amber-600"
            : "bg-[#E1F5EE] text-[#0F6E56]",
        ].join(" ")}
      >
        {row.avatar}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{row.phoneFormatted}</p>
          <span className="text-[9px] font-semibold uppercase tracking-wider bg-[#F4F3EF] text-[#A09E98] px-[6px] py-[1px] rounded-full shrink-0">
            {row.channelLabel}
          </span>
          {row.status !== "active" && row.statusLabel && (
            <span
              className={[
                "text-[9px] font-semibold uppercase tracking-wider px-[6px] py-[1px] rounded-full shrink-0 hidden sm:inline",
                row.status === "paused" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600",
              ].join(" ")}
            >
              {row.statusLabel}
            </span>
          )}
          {row.isPatient && (
            <span className="text-[9px] font-semibold uppercase tracking-wider bg-[#E1F5EE] text-[#0F6E56] px-[6px] py-[1px] rounded-full shrink-0 hidden sm:inline">
              {patientBadge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-[#A09E98] truncate mt-[1px]">
          {row.lastText ? `${row.lastPrefix} ${row.lastText}` : row.lastText}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-[10px] text-[#A09E98]">{row.timeAgo}</p>
        <p className="text-[10px] text-[#D3D1C7] mt-[1px]">{row.msgCount}</p>
      </div>

      <svg className="w-3 h-3 text-[#D3D1C7] group-hover:text-[#A09E98] transition shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Link>
  );
}

export function ConversationsList({
  rows,
  patientBadge,
  activeCount,
  humanCount,
}: {
  rows: ConvRowData[];
  patientBadge: string;
  activeCount: number;
  humanCount: number;
}) {
  const t = useTranslations("whatsapp");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "with_team" && r.status === "active") return false;
      if (filter === "active" && r.status !== "active") return false;
      if (q && !r.search.includes(q)) return false;
      return true;
    });
  }, [rows, query, filter]);

  const chip = (value: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={[
        "text-[11px] font-medium px-[10px] py-[5px] rounded-full transition whitespace-nowrap",
        filter === value ? "bg-[#0F1A2E] text-white" : "bg-[#F4F3EF] text-[#A09E98] hover:text-[#0F1A2E]",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden">
      {/* Busca + filtros */}
      <div className="px-[12px] py-[10px] border-b border-black/[.05] flex flex-col sm:flex-row sm:items-center gap-[8px]">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-[10px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C5C3BC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full text-[13px] text-[#0F1A2E] bg-[#FAFAF8] border border-black/[.08] rounded-[8px] pl-[32px] pr-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
          />
        </div>
        <div className="flex items-center gap-[6px] overflow-x-auto">
          {chip("all", t("search.all"))}
          {chip("active", `${t("search.aiActive")} (${activeCount})`)}
          {chip("with_team", `${t("search.withTeam")} (${humanCount})`)}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-[48px] px-[20px] text-center">
          <div className="w-12 h-12 rounded-full bg-[#F4F3EF] flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A09E98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <p className="text-[13px] text-[#A09E98]">
            {rows.length === 0 ? t("page.emptyTitle") : t("search.noResults")}
          </p>
          {rows.length === 0 && <p className="text-[11px] text-[#C5C3BC] mt-1">{t("page.emptyHint")}</p>}
        </div>
      ) : (
        <div className="divide-y divide-black/[.04]">
          {filtered.map((row) => (
            <Row key={row.id} row={row} patientBadge={patientBadge} />
          ))}
        </div>
      )}
    </div>
  );
}
