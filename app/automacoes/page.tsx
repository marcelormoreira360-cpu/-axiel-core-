import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { AutomacoesClient } from "@/components/automacoes-client";
import { BroadcastWhatsAppModal } from "@/components/broadcast-whatsapp-modal";
import { getRecentBroadcasts } from "@/services/broadcast-service";
import { getCurrentUserProfile } from "@/services/user-service";

const SEGMENT_KEYS: Record<string, string> = {
  all_active:  "segAllActive",
  inactive_30: "segInactive30",
  inactive_60: "segInactive60",
  custom:      "segCustom",
};

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-[#E1F5EE] text-[#0F6E56]",
  partial:   "bg-amber-50 text-amber-700",
  failed:    "bg-red-50 text-red-500",
};

export default async function AutomacoesPage() {
  const t = await getTranslations("automations.page");
  const locale = await getLocale();
  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id;
  const isManager = ["clinic_owner", "clinic_manager"].includes(profile?.role ?? "");

  const recentBroadcasts = clinicId && isManager
    ? await getRecentBroadcasts(clinicId, 5).catch(() => [])
    : [];

  return (
    <Shell>
      {/* Header */}
      <div className="flex items-start justify-between mb-[20px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("eyebrow")}</p>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">
            {t("title")}
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {t("subtitle")}
          </p>
        </div>
        {isManager && <BroadcastWhatsAppModal />}
      </div>

      {/* ── Envio em massa — histórico ── */}
      {isManager && recentBroadcasts.length > 0 && (
        <div className="mb-6 bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[14px] overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[.05] dark:border-white/[.06]">
            <p className="text-[12px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">
              {t("recentTitle")}
            </p>
          </div>
          <div className="divide-y divide-black/[.04] dark:divide-white/[.04]">
            {recentBroadcasts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] truncate">
                    {c.title}
                  </p>
                  <p className="text-[11px] text-[#A09E98] mt-[1px]">
                    {SEGMENT_KEYS[c.segment] ? t(SEGMENT_KEYS[c.segment]) : c.segment} ·{" "}
                    {new Date(c.created_at).toLocaleDateString(locale, {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-[#6B6A66] dark:text-[#9E9C97]">
                    {c.sent_count}/{c.total_recipients}
                  </span>
                  <span className={`text-[10px] font-medium px-[7px] py-[2px] rounded-full ${STATUS_STYLES[c.status] ?? "bg-[#F4F3EF] text-[#A09E98]"}`}>
                    {c.status === "completed" ? t("statusCompleted")
                      : c.status === "partial" ? t("statusPartial")
                      : t("statusFailed")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Automações individuais ── */}
      <AutomacoesClient />
    </Shell>
  );
}
