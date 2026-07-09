import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ClipboardList, Plus, ChevronRight } from "lucide-react";
import type { Appointment, SessionRecord } from "@/lib/types";

/**
 * Acompanhamento do Tratamento (agregador da ficha): o Resumo do caso direciona,
 * e cada SESSÃO é uma entrada que abre o "Registro de sessão" (notas/SOAP/vitais/
 * observações — tudo para acompanhar e registrar a evolução do paciente a cada sessão).
 */

const STATUS_KEYS = new Set(["pending", "scheduled", "confirmed", "completed", "no_show", "cancelled"]);

const STATUS_CLS: Record<string, string> = {
  completed: "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#085041] dark:text-[#9FE1CB]",
  confirmed: "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#085041] dark:text-[#9FE1CB]",
  scheduled: "bg-[#F4F3EF] text-[#6B6A66]",
  pending: "bg-[#FAEEDA] dark:bg-[#C77D17]/[.15] text-[#633806] dark:text-[#E8B04B]",
  no_show: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400",
  cancelled: "bg-[#F4F3EF] text-[#A09E98]",
};

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

function noteSnippet(s?: SessionRecord): string | null {
  if (!s) return null;
  return (
    s.notes ||
    s.subjective ||
    s.plan ||
    s.assessment_note ||
    (s.key_observations?.length ? s.key_observations.join(" · ") : "")
  ).trim() || null;
}

export async function PatientTreatmentFollowupPanel({
  patientId,
  appointments,
  sessions,
}: {
  patientId: string;
  appointments: Appointment[];
  sessions: SessionRecord[];
}) {
  const t = await getTranslations("patientPanels.treatmentFollowup");
  const locale = await getLocale();
  const recordByAppt = new Map(sessions.map((s) => [s.appointment_id, s]));
  const list = appointments
    .filter((a) => a.status !== "cancelled")
    .slice()
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, 6);

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] px-[22px] py-[16px]">
      <div className="flex items-center justify-between mb-[12px]">
        <span className="flex items-center gap-[7px] text-[13px] font-medium text-[#0F1A2E]">
          <ClipboardList className="h-[16px] w-[16px] text-[#0F6E56] dark:text-[#9FE1CB]" /> {t("title")}
        </span>
        <Link
          href={`/schedule/new?patient_id=${patientId}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] border border-black/[.08] rounded-[6px] px-[10px] py-[5px] hover:bg-[#F0FAF6] dark:hover:bg-[#0F6E56]/[.12] transition"
        >
          <Plus className="h-3 w-3" /> {t("newSession")}
        </Link>
      </div>

      {list.length === 0 ? (
        <p className="text-[12px] text-[#A09E98]">
          {t("empty")}
        </p>
      ) : (
        <div className="divide-y divide-black/[.05] dark:divide-white/[.06] border-t border-black/[.05] dark:border-white/[.06]">
          {list.map((a) => {
            const rec = recordByAppt.get(a.id);
            const snippet = noteSnippet(rec);
            const status = a.status ?? "scheduled";
            return (
              <Link
                key={a.id}
                href={`/schedule/${a.id}/session`}
                className="flex items-start gap-[10px] py-[10px] -mx-[6px] px-[6px] rounded-[6px] hover:bg-[#FAFAF8] dark:hover:bg-white/[.04] transition group"
              >
                <span className="text-[11px] text-[#A09E98] w-[64px] shrink-0 pt-[2px]">{fmtDate(a.starts_at, locale)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[6px] flex-wrap">
                    <span className="text-[12px] font-medium text-[#0F1A2E]">{a.session_types?.name ?? t("sessionFallback")}</span>
                    <span className={`text-[10px] rounded-full px-[7px] py-[1px] ${STATUS_CLS[status] ?? "bg-[#F4F3EF] text-[#6B6A66]"}`}>
                      {STATUS_KEYS.has(status) ? t(`status.${status}`) : status}
                    </span>
                    {rec?.soap_mode && (
                      <span className="text-[10px] bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#085041] dark:text-[#9FE1CB] rounded-[4px] px-[6px] py-[1px]">SOAP</span>
                    )}
                  </div>
                  {snippet ? (
                    <p className="text-[11px] text-[#6B6A66] mt-[3px] leading-[1.5] line-clamp-2">{snippet}</p>
                  ) : (
                    <p className="text-[11px] text-[#C4A05A] mt-[3px]">{t("noNote")}</p>
                  )}
                </div>
                <ChevronRight className="h-[15px] w-[15px] text-[#D3D1C7] dark:text-white/25 group-hover:text-[#0F6E56] dark:group-hover:text-[#9FE1CB] transition self-center shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
