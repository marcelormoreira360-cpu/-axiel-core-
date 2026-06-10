import { getTranslations } from "next-intl/server";
import { getReferralStats } from "@/services/referral-service";
import { ReferralCopyButton } from "./referral-copy-button";

/**
 * Card "Indique e ganhe 1 mês grátis" — dashboard, só para roles gestores
 * (o caller filtra via isManager). Server component: busca código + stats.
 * Best-effort: se a migration 075 ainda não estiver aplicada ou algo falhar,
 * o card simplesmente não renderiza (nunca derruba o dashboard).
 */
export async function ReferralCard({ clinicId }: { clinicId: string }) {
  let stats: Awaited<ReturnType<typeof getReferralStats>> | null = null;
  try {
    stats = await getReferralStats(clinicId);
  } catch {
    return null;
  }
  if (!stats?.code) return null;

  const t = await getTranslations("referral");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const link = `${appUrl}/auth/signup?ref=${stats.code}`;

  return (
    <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[12px] p-[15px]">
      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[6px]">
            <div className="w-[18px] h-[18px] rounded-[4px] bg-[#E1F5EE] flex items-center justify-center shrink-0">
              <svg className="w-[10px] h-[10px] text-[#0F6E56]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7a3 3 0 1 1 3-3c0 1.5-1.5 3-3 3zM12 7a3 3 0 1 0-3-3c0 1.5 1.5 3 3 3z" />
              </svg>
            </div>
            <p className="text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{t("title")}</p>
          </div>
          <p className="mt-[4px] text-[11px] text-[#A09E98]">{t("description")}</p>
        </div>
        <div className="flex items-center gap-[10px] text-[10px] text-[#6B6A66] dark:text-[#A09E98] shrink-0">
          <span className="rounded-full bg-[#F4F3EF] dark:bg-white/[.06] px-[8px] py-[2px]">
            {t("statsSignedUp", { count: stats.signedUp })}
          </span>
          <span className="rounded-full bg-[#E1F5EE] text-[#0F6E56] px-[8px] py-[2px]">
            {t("statsConverted", { count: stats.converted })}
          </span>
        </div>
      </div>
      <div className="mt-[10px] flex items-center gap-[8px]">
        <code className="min-w-0 flex-1 truncate rounded-[8px] bg-[#FAFAF8] dark:bg-white/[.04] border border-black/[.06] dark:border-white/[.08] px-[10px] py-[7px] text-[11px] text-[#6B6A66] dark:text-[#A09E98]">
          {link}
        </code>
        <ReferralCopyButton link={link} />
      </div>
    </div>
  );
}
