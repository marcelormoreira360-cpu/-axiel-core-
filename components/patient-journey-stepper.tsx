/**
 * patient-journey-stepper.tsx — Fase 2 (Intelligent Patient Journey).
 *
 * Stepper da jornada de cuidado no topo da ficha do paciente: mostra as
 * etapas de PERMANÊNCIA (Preparação → Avaliação → Cuidado ativo →
 * Continuidade → Renovação) e destaca onde o paciente está agora.
 *
 * Server Component. Aditivo (cabeçalho fixo), NÃO toca no sectionLayout
 * reordenável. A etapa vem derivada em runtime (toCanonicalStage), zero
 * query extra.
 */

import { getTranslations } from "next-intl/server";
import {
  CANONICAL_JOURNEY_STAGES,
  JOURNEY_STAGE_KIND,
  type CanonicalJourneyStage,
} from "@/modules/patient-journey/journey";

export async function PatientJourneyStepper({ current }: { current: CanonicalJourneyStage }) {
  const t = await getTranslations("patientPanels.journeyStepper");
  const stages = CANONICAL_JOURNEY_STAGES.filter((s) => JOURNEY_STAGE_KIND[s] === "permanence");
  const currentIndex = stages.indexOf(current);

  return (
    <div className="border border-t-0 border-black/[.07] bg-white px-[22px] py-[11px] dark:border-white/[.07] dark:bg-[#13212F]">
      <div className="flex items-center gap-[10px] overflow-x-auto">
        <span className="shrink-0 text-[10px] uppercase tracking-[.06em] text-[#A09E98]">{t("title")}</span>
        <ol className="flex min-w-0 items-center gap-[4px]">
          {stages.map((s, i) => {
            const done = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <li key={s} className="flex shrink-0 items-center gap-[4px]">
                {i > 0 && (
                  <span
                    className={`h-px w-[14px] ${
                      done || isCurrent ? "bg-[#0F6E56]/40" : "bg-black/[.10] dark:bg-white/[.10]"
                    }`}
                  />
                )}
                <span
                  className={[
                    "whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11px]",
                    isCurrent
                      ? "bg-[#0F6E56] font-medium text-white"
                      : done
                        ? "bg-[#E1F5EE] text-[#085041] dark:bg-[#0F6E56]/20 dark:text-[#9FE1CB]"
                        : "text-[#A09E98] dark:text-[#6B6A66]",
                  ].join(" ")}
                >
                  {t(`stage.${s}`)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
