import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getCurrentUserProfile } from "@/services/user-service";
import { isManager } from "@/lib/team-utils";
import { getPatientTrends } from "@/services/patient-trends-service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tendências — AXIEL Core" };

export default async function TrendsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile || !isManager(profile.role)) redirect("/dashboard");

  const t = await getTranslations("trends");
  const { rows, totalConsented, distinctCities, byAgeBand } = await getPatientTrends();

  const ageLabel = (band: string) => (band === "desconhecido" ? t("ageUnknown") : band);

  return (
    <Shell>
      <div className="mb-[22px]">
        <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E] dark:text-[#E8E6E2]">{t("title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("subtitle")}</p>
      </div>

      {/* Aviso de privacidade */}
      <div className="bg-[#E1F5EE] dark:bg-[#0F6E56]/20 border border-[#0F6E56]/20 rounded-[12px] px-[16px] py-[12px] mb-[20px]">
        <p className="text-[12px] text-[#0B5A45] dark:text-[#9FE1CB] leading-relaxed">{t("privacyBanner")}</p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] px-[20px] py-[40px] text-center">
          <p className="text-[13px] text-[#6B6A66] dark:text-[#9E9C97] mb-[4px]">{t("emptyTitle")}</p>
          <p className="text-[11px] text-[#A09E98]">{t("emptyDesc")}</p>
        </div>
      ) : (
        <div className="space-y-[20px]">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-[10px]">
            <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] px-[16px] py-[14px]">
              <p className="text-[11px] text-[#A09E98]">{t("kpiConsented")}</p>
              <p className="text-[22px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mt-[2px]">{totalConsented}</p>
            </div>
            <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] px-[16px] py-[14px]">
              <p className="text-[11px] text-[#A09E98]">{t("kpiCities")}</p>
              <p className="text-[22px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mt-[2px]">{distinctCities}</p>
            </div>
            <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] px-[16px] py-[14px]">
              <p className="text-[11px] text-[#A09E98]">{t("kpiGroups")}</p>
              <p className="text-[22px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] mt-[2px]">{rows.length}</p>
            </div>
          </div>

          {/* Por faixa etária */}
          <section className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] px-[18px] py-[16px]">
            <p className="text-[11px] font-medium tracking-[.07em] uppercase text-[#A09E98] mb-[12px]">{t("byAge")}</p>
            <div className="space-y-[7px]">
              {byAgeBand.map((b) => {
                const pct = totalConsented ? Math.round((b.patient_count / totalConsented) * 100) : 0;
                return (
                  <div key={b.age_band} className="flex items-center gap-[10px]">
                    <span className="text-[12px] text-[#6B6A66] dark:text-[#9E9C97] w-[90px] shrink-0">{ageLabel(b.age_band)}</span>
                    <div className="flex-1 h-[8px] bg-[#F4F3EF] dark:bg-white/[.06] rounded-full overflow-hidden">
                      <div className="h-full bg-[#0F6E56] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] tabular-nums w-[58px] text-right shrink-0">
                      {b.patient_count} · {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Tabela por região */}
          <section className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] overflow-hidden">
            <p className="text-[11px] font-medium tracking-[.07em] uppercase text-[#A09E98] px-[18px] pt-[16px] pb-[10px]">
              {t("byRegion")}
            </p>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[#A09E98] border-b border-black/[.06] dark:border-white/[.06]">
                  <th className="text-left font-medium px-[18px] py-[8px]">{t("colCity")}</th>
                  <th className="text-left font-medium px-[12px] py-[8px]">{t("colState")}</th>
                  <th className="text-left font-medium px-[12px] py-[8px]">{t("colAge")}</th>
                  <th className="text-right font-medium px-[18px] py-[8px]">{t("colCount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-black/[.04] dark:border-white/[.04] last:border-0">
                    <td className="px-[18px] py-[8px] text-[#0F1A2E] dark:text-[#E8E6E2]">{r.city ?? "—"}</td>
                    <td className="px-[12px] py-[8px] text-[#6B6A66] dark:text-[#9E9C97]">{r.state ?? "—"}</td>
                    <td className="px-[12px] py-[8px] text-[#6B6A66] dark:text-[#9E9C97]">{ageLabel(r.age_band)}</td>
                    <td className="px-[18px] py-[8px] text-right text-[#0F1A2E] dark:text-[#E8E6E2] tabular-nums">{r.patient_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </Shell>
  );
}
