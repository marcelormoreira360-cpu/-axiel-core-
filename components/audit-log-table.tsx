"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import type { AuditLogRow } from "@/services/audit-service";

const ACTION_COLORS: Record<string, { dot: string; badge: string }> = {
  blue:   { dot: "bg-[#4B9CF5]", badge: "text-[#2563EB] bg-[#EFF6FF] dark:bg-[#2563EB]/20 dark:text-[#93C5FD]" },
  green:  { dot: "bg-[#0F6E56]", badge: "text-[#0F6E56] bg-[#E1F5EE] dark:bg-[#0F6E56]/20 dark:text-[#6EE7B7]" },
  purple: { dot: "bg-[#7C3AED]", badge: "text-[#7C3AED] bg-[#F5F3FF] dark:bg-[#7C3AED]/20 dark:text-[#C4B5FD]" },
  orange: { dot: "bg-[#EA580C]", badge: "text-[#EA580C] bg-[#FFF7ED] dark:bg-[#EA580C]/20 dark:text-[#FDBA74]" },
  yellow: { dot: "bg-[#CA8A04]", badge: "text-[#CA8A04] bg-[#FEFCE8] dark:bg-[#CA8A04]/20 dark:text-[#FDE047]" },
  teal:   { dot: "bg-[#0D9488]", badge: "text-[#0D9488] bg-[#F0FDFA] dark:bg-[#0D9488]/20 dark:text-[#5EEAD4]" },
  red:    { dot: "bg-[#DC2626]", badge: "text-[#DC2626] bg-[#FEF2F2] dark:bg-[#DC2626]/20 dark:text-[#FCA5A5]" },
  indigo: { dot: "bg-[#4F46E5]", badge: "text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#4F46E5]/20 dark:text-[#A5B4FC]" },
  gray:   { dot: "bg-[#A09E98]", badge: "text-[#6B6A66] bg-[#F4F3EF] dark:bg-white/[.06] dark:text-[#9E9C97]" },
};

function getActionColor(action: string): keyof typeof ACTION_COLORS {
  if (action.startsWith("patient."))        return "blue";
  if (action.startsWith("appointment."))    return "green";
  if (action.startsWith("ai_insight.") || action.startsWith("insight.")) return "purple";
  if (action.startsWith("user."))           return "orange";
  if (action.startsWith("lead."))           return "yellow";
  if (action.startsWith("session_record.")) return "teal";
  if (action.startsWith("subscription."))   return "red";
  if (action.startsWith("intake."))         return "indigo";
  return "gray";
}

function formatDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function MetadataCell({ metadata }: { metadata: Record<string, unknown> }) {
  const t = useTranslations("admin.table");
  const [open, setOpen] = useState(false);
  const keys = Object.keys(metadata);
  if (keys.length === 0) return <span className="text-[#A09E98]">—</span>;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-[#A09E98] hover:text-[#6B6A66] dark:hover:text-[#9E9C97] transition"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${open ? "rotate-90" : ""}`}>
          <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {t("fields", { count: keys.length })}
      </button>
      {open && (
        <pre className="mt-2 text-[10px] text-[#6B6A66] dark:text-[#9E9C97] bg-[#F4F3EF] dark:bg-white/[.04] border border-black/[.07] dark:border-white/[.07] rounded-[6px] px-[8px] py-[6px] overflow-x-auto max-w-[260px]">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  const t = useTranslations("admin.table");
  const locale = useLocale();
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-10 h-10 rounded-full bg-[#F4F3EF] dark:bg-white/[.06] flex items-center justify-center mb-3">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="3" y="2" width="12" height="14" rx="2" stroke="#A09E98" strokeWidth="1.3"/>
            <path d="M6 6h6M6 9h6M6 12h4" stroke="#A09E98" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="text-[13px] text-[#A09E98]">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-black/[.05] dark:border-white/[.05]">
            {[t("cols.time"), t("cols.user"), t("cols.action"), t("cols.entity"), t("cols.entityId"), t("cols.details")].map((h) => (
              <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] px-4 py-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
          {rows.map((row) => {
            const colorKey = getActionColor(row.action);
            const colors = ACTION_COLORS[colorKey];
            const userName = row.users?.full_name ?? row.users?.email ?? t("system");

            return (
              <tr key={row.id} className="hover:bg-[#FAFAF8] dark:hover:bg-white/[.02] transition group">
                {/* Hora */}
                <td className="px-4 py-[10px] text-[#A09E98] whitespace-nowrap font-mono text-[11px]">
                  {formatDateTime(row.created_at, locale)}
                </td>

                {/* Usuário */}
                <td className="px-4 py-[10px]">
                  <div className="flex items-center gap-[6px]">
                    <div className="w-[20px] h-[20px] rounded-full bg-[#F4F3EF] dark:bg-white/[.07] flex items-center justify-center text-[8px] font-medium text-[#6B6A66] dark:text-[#9E9C97] shrink-0">
                      {userName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-[#0F1A2E] dark:text-[#E8E6E2] truncate max-w-[120px]">{userName}</span>
                  </div>
                </td>

                {/* Ação */}
                <td className="px-4 py-[10px]">
                  <div className="flex items-center gap-[6px]">
                    <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${colors.dot}`} />
                    <span className={`text-[10px] font-medium px-[7px] py-[2px] rounded-full font-mono ${colors.badge}`}>
                      {row.action}
                    </span>
                  </div>
                </td>

                {/* Entidade */}
                <td className="px-4 py-[10px] text-[#6B6A66] dark:text-[#9E9C97]">
                  {row.entity_type}
                </td>

                {/* ID */}
                <td className="px-4 py-[10px] text-[#A09E98] font-mono text-[10px]">
                  {row.entity_id ? row.entity_id.slice(0, 8) + "…" : "—"}
                </td>

                {/* Metadata */}
                <td className="px-4 py-[10px]">
                  <MetadataCell metadata={row.metadata} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
