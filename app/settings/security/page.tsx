import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/card";
import { BackLink } from "@/components/back-link";
import { SimplePageHeader } from "@/components/simple-page-header";
import { getRlsStatus, summarizeRlsStatus } from "@/services/security-service";
import { MfaSettings } from "@/components/mfa-settings";

export default async function SecuritySettingsPage() {
  const t = await getTranslations("settings");
  const rows = await getRlsStatus();
  const summary = summarizeRlsStatus(rows);

  return (
    <div className="space-y-6">
      <BackLink fallbackHref="/settings" className="inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back")}
      </BackLink>

      <MfaSettings />

      <SimplePageHeader
        eyebrow={t("common.eyebrow")}
        title={t("security.title")}
        helper={t("security.helper")}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-black/50">{t("security.tablesChecked")}</p>
          <p className="mt-3 text-4xl font-semibold text-axiel-ink">{summary.total}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-black/50">{t("security.protected")}</p>
          <p className="mt-3 text-4xl font-semibold text-axiel-ink">{summary.protected}</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-black/50">{t("security.needsAttention")}</p>
          <p className="mt-3 text-4xl font-semibold text-axiel-ink">{summary.needsAttention.length}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold text-axiel-ink">{t("security.rlsStatus")}</h2>
        <div className="mt-4 space-y-2">
          {rows.map((row) => (
            <div key={row.tablename} className="flex items-center justify-between rounded-2xl border border-axiel-line p-3">
              <span className="text-sm font-medium text-axiel-ink">{row.tablename}</span>
              <span className={row.rls_enabled ? "text-sm text-emerald-700" : "text-sm text-red-700"}>
                {row.rls_enabled ? t("security.rowProtected") : t("security.rowOff")}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
