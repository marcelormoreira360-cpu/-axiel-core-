import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getAuditLogs, getCommunicationLogs } from "@/services/audit-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { AuditLogTable } from "@/components/audit-log-table";
import { canManageClinicUsers } from "@/modules/auth/roles";

function formatDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// Color-code action categories
function actionMeta(action: string): { label: string; color: string } {
  if (action.startsWith("patient."))      return { label: action, color: "blue" };
  if (action.startsWith("appointment."))  return { label: action, color: "green" };
  if (action.startsWith("ai_insight.") || action.startsWith("insight.")) return { label: action, color: "purple" };
  if (action.startsWith("user."))         return { label: action, color: "orange" };
  if (action.startsWith("lead."))         return { label: action, color: "yellow" };
  if (action.startsWith("session_record.")) return { label: action, color: "teal" };
  if (action.startsWith("subscription.")) return { label: action, color: "red" };
  if (action.startsWith("intake."))       return { label: action, color: "indigo" };
  return { label: action, color: "gray" };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; action?: string; from?: string; to?: string; page?: string }>;
}) {
  const profile = await getCurrentUserProfile();
  if (!profile || !canManageClinicUsers(profile.role)) redirect("/dashboard");

  const t = await getTranslations("admin");
  const locale = await getLocale();
  const sp = await searchParams;
  const tab = sp.tab ?? "audit";
  const page = Math.max(0, Number(sp.page ?? 0));
  const LIMIT = 50;

  const [{ rows: auditRows, total: auditTotal }, { rows: commRows, total: commTotal }] = await Promise.all([
    getAuditLogs({
      clinicId: profile.clinic_id,
      action: sp.action || undefined,
      from: sp.from || undefined,
      to: sp.to || undefined,
      limit: LIMIT,
      offset: page * LIMIT,
    }),
    getCommunicationLogs({
      clinicId: profile.clinic_id,
      from: sp.from || undefined,
      to: sp.to || undefined,
      limit: LIMIT,
      offset: page * LIMIT,
    }),
  ]);

  const totalPages = Math.ceil((tab === "audit" ? auditTotal : commTotal) / LIMIT);

  return (
    <Shell>
      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-[4px]">{t("eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">
          {t("audit.title")}
        </h1>
        <p className="text-[13px] text-[#A09E98] mt-[3px]">
          {t("audit.subtitle")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-[10px] mb-6">
        <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[10px] px-[14px] py-[12px]">
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[5px]">{t("audit.statActions")}</p>
          <p className="text-[24px] font-semibold tracking-[-0.04em] text-[#0F1A2E] dark:text-[#E8E6E2] leading-none">{auditTotal.toLocaleString(locale)}</p>
        </div>
        <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[10px] px-[14px] py-[12px]">
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[5px]">{t("audit.statComms")}</p>
          <p className="text-[24px] font-semibold tracking-[-0.04em] text-[#0F1A2E] dark:text-[#E8E6E2] leading-none">{commTotal.toLocaleString(locale)}</p>
        </div>
        <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[10px] px-[14px] py-[12px]">
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[5px]">{t("audit.statLast")}</p>
          <p className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] leading-tight">
            {auditRows[0] ? new Date(auditRows[0].created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "—"}
          </p>
        </div>
      </div>

      {/* Tabs + filters */}
      <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] overflow-hidden">

        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-black/[.06] dark:border-white/[.07] px-4">
          {[
            { key: "audit", label: t("audit.tabAudit"), count: auditTotal },
            { key: "comm",  label: t("audit.tabComm"),  count: commTotal },
          ].map((tab2) => {
            const active = tab === tab2.key;
            const href = `?tab=${tab2.key}${sp.action ? `&action=${sp.action}` : ""}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`;
            return (
              <a
                key={tab2.key}
                href={href}
                className={`flex items-center gap-[6px] px-[14px] py-[12px] text-[13px] border-b-2 transition
                  ${active
                    ? "border-[#0F6E56] text-[#0F1A2E] dark:text-[#E8E6E2] font-medium"
                    : "border-transparent text-[#A09E98] hover:text-[#6B6A66] dark:hover:text-[#9E9C97]"
                  }`}
              >
                {tab2.label}
                <span className={`text-[10px] px-[6px] py-[1px] rounded-full ${active ? "bg-[#E1F5EE] text-[#0F6E56]" : "bg-[#F4F3EF] dark:bg-white/[.06] text-[#A09E98]"}`}>
                  {tab2.count.toLocaleString(locale)}
                </span>
              </a>
            );
          })}

          {/* Filter form */}
          <form method="GET" className="flex items-center gap-2 ml-auto py-2">
            <input type="hidden" name="tab" value={tab} />
            {tab === "audit" && (
              <input
                name="action"
                defaultValue={sp.action ?? ""}
                placeholder={t("audit.filterAction")}
                className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-[#F4F3EF] dark:bg-white/[.06] border border-black/[.08] dark:border-white/[.08] rounded-[7px] px-[10px] py-[5px] w-[160px] outline-none focus:border-[#0F6E56] placeholder:text-[#C5C3BC] dark:placeholder:text-[#6B6A66]"
              />
            )}
            <input
              type="date"
              name="from"
              defaultValue={sp.from ?? ""}
              className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-[#F4F3EF] dark:bg-white/[.06] border border-black/[.08] dark:border-white/[.08] rounded-[7px] px-[8px] py-[5px] outline-none focus:border-[#0F6E56]"
            />
            <input
              type="date"
              name="to"
              defaultValue={sp.to ?? ""}
              className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-[#F4F3EF] dark:bg-white/[.06] border border-black/[.08] dark:border-white/[.08] rounded-[7px] px-[8px] py-[5px] outline-none focus:border-[#0F6E56]"
            />
            <button
              type="submit"
              className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[12px] py-[5px] rounded-[7px]"
            >
              {t("audit.filter")}
            </button>
            {(sp.action || sp.from || sp.to) && (
              <a href={`?tab=${tab}`} className="text-[12px] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition">
                {t("audit.clear")}
              </a>
            )}
          </form>
        </div>

        {/* Table */}
        {tab === "audit" ? (
          <AuditLogTable rows={auditRows} />
        ) : (
          /* Communications table */
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-black/[.05] dark:border-white/[.05]">
                  {[t("audit.commCols.time"), t("audit.commCols.channel"), t("audit.commCols.patient"), t("audit.commCols.to"), t("audit.commCols.type"), t("audit.commCols.status"), t("audit.commCols.provider")].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
                {commRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#A09E98]">
                      {t("audit.noComms")}
                    </td>
                  </tr>
                ) : commRows.map((row) => {
                  const statusColor =
                    row.status === "sent"   ? "text-[#0F6E56] bg-[#E1F5EE]" :
                    row.status === "failed" ? "text-[#EB5757] bg-[#FEECEC]" :
                    "text-[#A09E98] bg-[#F4F3EF] dark:bg-white/[.06]";
                  const channelColor = row.channel === "whatsapp" ? "text-[#25D366] bg-[#25D366]/[.10]" :
                    row.channel === "email" ? "text-[#4B9CF5] bg-[#4B9CF5]/[.10]" :
                    "text-[#A09E98] bg-[#F4F3EF]";
                  return (
                    <tr key={row.id} className="hover:bg-[#FAFAF8] dark:hover:bg-white/[.02] transition">
                      <td className="px-4 py-[10px] text-[#A09E98] whitespace-nowrap">
                        {formatDateTime(row.created_at, locale)}
                      </td>
                      <td className="px-4 py-[10px]">
                        <span className={`text-[10px] font-medium px-[7px] py-[2px] rounded-full uppercase tracking-[.05em] ${channelColor}`}>
                          {row.channel}
                        </span>
                      </td>
                      <td className="px-4 py-[10px] text-[#0F1A2E] dark:text-[#E8E6E2]">
                        {row.patients?.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-[10px] text-[#6B6A66] dark:text-[#9E9C97] font-mono text-[11px]">
                        {row.recipient}
                      </td>
                      <td className="px-4 py-[10px] text-[#6B6A66] dark:text-[#9E9C97]">
                        {row.use_case.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-[10px]">
                        <span className={`text-[10px] font-medium px-[7px] py-[2px] rounded-full ${statusColor}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-[10px] text-[#A09E98]">
                        {row.provider ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-black/[.05] dark:border-white/[.05]">
            <p className="text-[12px] text-[#A09E98]">
              {t("audit.pagination", { page: page + 1, pages: totalPages, count: (tab === "audit" ? auditTotal : commTotal).toLocaleString(locale) })}
            </p>
            <div className="flex gap-2">
              {page > 0 && (
                <a
                  href={`?tab=${tab}&page=${page - 1}${sp.action ? `&action=${sp.action}` : ""}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}
                  className="text-[12px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 px-[12px] py-[5px] rounded-[7px] hover:bg-[#0F6E56]/[.07] transition"
                >
                  ← Anterior
                </a>
              )}
              {page < totalPages - 1 && (
                <a
                  href={`?tab=${tab}&page=${page + 1}${sp.action ? `&action=${sp.action}` : ""}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}
                  className="text-[12px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 px-[12px] py-[5px] rounded-[7px] hover:bg-[#0F6E56]/[.07] transition"
                >
                  Próxima →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
