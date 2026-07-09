import { getTranslations } from "next-intl/server";

const USE_CASE_KEYS = new Set([
  "appointment_reminder",
  "appointment_confirmation",
  "follow_up",
  "lead_nurturing",
  "package_low",
]);

export async function CommunicationLogList({ logs }: { logs: Array<Record<string, unknown>> }) {
  const t = await getTranslations("automations.commLog");

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("now");
    if (mins < 60) return t("minutesShort", { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("hoursShort", { n: hrs });
    return t("daysShort", { n: Math.floor(hrs / 24) });
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white border border-black/[.07] rounded-[14px] flex flex-col items-center justify-center py-[40px] px-[16px] text-center">
        <div className="w-10 h-10 rounded-full bg-[#F4F3EF] flex items-center justify-center mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A09E98" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </div>
        <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden">
      <div className="divide-y divide-black/[.04]">
        {logs.map((log) => {
          const isSent   = log.status === "sent";
          const isFailed = log.status === "failed";
          const isEmail  = log.channel === "email";
          const useCaseRaw = String(log.use_case ?? "");
          const useCase  = USE_CASE_KEYS.has(useCaseRaw)
            ? t(`useCases.${useCaseRaw as "appointment_reminder" | "appointment_confirmation" | "follow_up" | "lead_nurturing" | "package_low"}`)
            : useCaseRaw;
          const body     = String(log.body ?? "");

          return (
            <div key={String(log.id)} className="px-[14px] py-[11px]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* Channel + use case */}
                  <div className="flex items-center gap-[6px] mb-[3px]">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-[6px] py-[1px] rounded-full ${isEmail ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                      {isEmail ? "Email" : "SMS"}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider bg-[#F4F3EF] text-[#6B6A66] px-[6px] py-[1px] rounded-full">
                      {useCase}
                    </span>
                  </div>
                  {/* Recipient */}
                  <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{String(log.recipient ?? "")}</p>
                  {/* Body preview */}
                  <p className="text-[11px] text-[#A09E98] truncate mt-[1px]">{body}</p>
                </div>
                {/* Status + time */}
                <div className="text-right shrink-0">
                  <span className={[
                    "inline-flex items-center gap-[3px] text-[9px] font-semibold uppercase tracking-wider px-[6px] py-[2px] rounded-full",
                    isSent   ? "bg-[#E1F5EE] text-[#0F6E56]" :
                    isFailed ? "bg-red-50 text-red-500" :
                    "bg-[#F4F3EF] text-[#6B6A66]",
                  ].join(" ")}>
                    {isSent   && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                    {isFailed && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    )}
                    {isSent ? t("sent") : isFailed ? t("failed") : t("queued")}
                  </span>
                  <p className="text-[10px] text-[#D3D1C7] mt-[3px]">{timeAgo(String(log.created_at))}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
