/**
 * journey-board.tsx — Command Center (Fase 1): board por etapa da jornada.
 *
 * Server Component. Mostra só as etapas de PERMANÊNCIA como colunas
 * (Preparação → Avaliação → Cuidado ativo → Continuidade → Renovação); as
 * etapas de evento (relatório/follow-up) aparecem como motivos de "precisa
 * de atenção" dentro das colunas. Cada item liga direto para a ficha.
 * O sistema REVELA; a clínica DECIDE e AGE (compliance).
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { JOURNEY_STAGE_KIND } from "@/modules/patient-journey/journey";
import type { JourneyBoard as JourneyBoardData } from "@/services/journey-board-service";

const VISIBLE_ATTENTION = 4;

export async function JourneyBoard({ board }: { board: JourneyBoardData }) {
  const t = await getTranslations("dashboard.journeyBoard");
  const columns = board.buckets.filter((b) => JOURNEY_STAGE_KIND[b.stage] === "permanence");

  return (
    <section className="mb-[18px]">
      <div className="mb-[10px] flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{t("title")}</h2>
        <span className="text-[11px] text-[#A09E98]">{t("subtitle")}</span>
      </div>

      <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-3 lg:grid-cols-5">
        {columns.map((b) => (
          <div
            key={b.stage}
            className="rounded-[12px] border border-black/[.07] bg-white p-[14px] dark:border-white/[.07] dark:bg-[#13212F]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[#6B6A66] dark:text-[#9E9C97]">
                {t(`stage.${b.stage}`)}
              </span>
              <span className="text-[20px] font-semibold tabular-nums text-[#0F1A2E] dark:text-[#E8E6E2]">
                {b.count}
              </span>
            </div>

            <div className="mt-[10px] space-y-[6px]">
              {b.needsAttention.length === 0 ? (
                <p className="text-[11px] text-[#A09E98]">{t("allClear")}</p>
              ) : (
                <>
                  {b.needsAttention.slice(0, VISIBLE_ATTENTION).map((a) => (
                    <Link
                      key={a.patientId}
                      href={`/patients/${a.patientId}`}
                      className="group flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-[12px] text-[#0F1A2E] group-hover:text-[#0F6E56] dark:text-[#C9C7C2]">
                        {a.patientName || t("patientFallback")}
                      </span>
                      <span className="shrink-0 text-[10px] text-[#A09E98]">{t(`reason.${a.reason}`)}</span>
                    </Link>
                  ))}
                  {b.needsAttentionTotal > VISIBLE_ATTENTION && (
                    <Link
                      href="/patients"
                      className="block text-[11px] font-medium text-[#0F6E56] hover:underline"
                    >
                      +{b.needsAttentionTotal - VISIBLE_ATTENTION}
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
