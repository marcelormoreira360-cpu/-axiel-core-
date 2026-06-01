import { useTranslations } from "next-intl";
import type { PatientPackage } from "@/services/package-service";

/**
 * Badge discreto exibindo em qual sessão e pacote o paciente está.
 * Ex: "Sessão 4 · Pacote 3"
 *
 * Retorna null se não houver pacote ativo.
 */
export function SessionPackageBadge({
  packages,
}: {
  packages: PatientPackage[];
}) {
  const t = useTranslations("patientPanels.sessionBadge");
  const activePackage = packages.find((p) => p.is_active) ?? null;
  if (!activePackage) return null;

  // packages vem ordenado por created_at DESC (mais novo primeiro).
  // packageNumber = posição cronológica do pacote ativo (1º, 2º, 3º…).
  const activeIdx = packages.findIndex((p) => p.is_active);
  const packageNumber = packages.length - activeIdx;

  // sessionInPackage = próxima sessão a ocorrer dentro do pacote atual.
  const sessionInPackage = activePackage.sessions_used + 1;

  return (
    <div className="flex flex-col gap-[3px]">
      <span className="text-[10px] font-medium px-[7px] py-[2px] rounded-full bg-[#E1F5EE] text-[#085041] inline-flex w-fit">
        {t("label", { session: sessionInPackage, pkg: packageNumber })}
      </span>
      <p className="text-[10px] text-[#A09E98] truncate">{activePackage.name}</p>
      <div className="mt-[2px] h-[3px] bg-[#E1F5EE] rounded-full overflow-hidden w-full">
        <div
          className="h-full bg-[#0F6E56] rounded-full"
          style={{
            width: `${Math.min(
              100,
              Math.round((activePackage.sessions_used / activePackage.sessions_total) * 100),
            )}%`,
          }}
        />
      </div>
      <p className="text-[9px] text-[#A09E98]">
        {t("used", { used: activePackage.sessions_used, total: activePackage.sessions_total })}
      </p>
    </div>
  );
}
