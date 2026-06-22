import Link from "next/link";
import { ClipboardList, Plus, ChevronRight } from "lucide-react";
import type { Appointment, SessionRecord } from "@/lib/types";

/**
 * Acompanhamento do Tratamento (agregador da ficha): o Resumo do caso direciona,
 * e cada SESSÃO é uma entrada que abre o "Registro de sessão" (notas/SOAP/vitais/
 * observações — tudo para acompanhar e registrar a evolução do paciente a cada sessão).
 */

const STATUS_PT: Record<string, string> = {
  pending: "Aguardando",
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  no_show: "Faltou",
  cancelled: "Cancelada",
};

const STATUS_CLS: Record<string, string> = {
  completed: "bg-[#E1F5EE] text-[#085041]",
  confirmed: "bg-[#E1F5EE] text-[#085041]",
  scheduled: "bg-[#F4F3EF] text-[#6B6A66]",
  pending: "bg-[#FAEEDA] text-[#633806]",
  no_show: "bg-red-50 text-red-600",
  cancelled: "bg-[#F4F3EF] text-[#A09E98]",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
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

export function PatientTreatmentFollowupPanel({
  patientId,
  appointments,
  sessions,
}: {
  patientId: string;
  appointments: Appointment[];
  sessions: SessionRecord[];
}) {
  const recordByAppt = new Map(sessions.map((s) => [s.appointment_id, s]));
  const list = appointments
    .filter((a) => a.status !== "cancelled")
    .slice()
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, 6);

  return (
    <div className="bg-white border border-t-0 border-black/[.07] px-[22px] py-[16px]">
      <div className="flex items-center justify-between mb-[12px]">
        <span className="flex items-center gap-[7px] text-[13px] font-medium text-[#0F1A2E]">
          <ClipboardList className="h-[16px] w-[16px] text-[#0F6E56]" /> Acompanhamento do tratamento
        </span>
        <Link
          href={`/schedule/new?patient_id=${patientId}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] border border-black/[.08] rounded-[6px] px-[10px] py-[5px] hover:bg-[#F0FAF6] transition"
        >
          <Plus className="h-3 w-3" /> Nova sessão
        </Link>
      </div>

      {list.length === 0 ? (
        <p className="text-[12px] text-[#A09E98]">
          Nenhuma sessão ainda. Cada sessão registra notas, vitais e a evolução do paciente.
        </p>
      ) : (
        <div className="divide-y divide-black/[.05] border-t border-black/[.05]">
          {list.map((a) => {
            const rec = recordByAppt.get(a.id);
            const snippet = noteSnippet(rec);
            const status = a.status ?? "scheduled";
            return (
              <Link
                key={a.id}
                href={`/schedule/${a.id}/session`}
                className="flex items-start gap-[10px] py-[10px] -mx-[6px] px-[6px] rounded-[6px] hover:bg-[#FAFAF8] transition group"
              >
                <span className="text-[11px] text-[#A09E98] w-[64px] shrink-0 pt-[2px]">{fmtDate(a.starts_at)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[6px] flex-wrap">
                    <span className="text-[12px] font-medium text-[#0F1A2E]">{a.session_types?.name ?? "Sessão"}</span>
                    <span className={`text-[10px] rounded-full px-[7px] py-[1px] ${STATUS_CLS[status] ?? "bg-[#F4F3EF] text-[#6B6A66]"}`}>
                      {STATUS_PT[status] ?? status}
                    </span>
                    {rec?.soap_mode && (
                      <span className="text-[10px] bg-[#E1F5EE] text-[#085041] rounded-[4px] px-[6px] py-[1px]">SOAP</span>
                    )}
                  </div>
                  {snippet ? (
                    <p className="text-[11px] text-[#6B6A66] mt-[3px] leading-[1.5] line-clamp-2">{snippet}</p>
                  ) : (
                    <p className="text-[11px] text-[#C4A05A] mt-[3px]">Sem nota — abrir para registrar.</p>
                  )}
                </div>
                <ChevronRight className="h-[15px] w-[15px] text-[#D3D1C7] group-hover:text-[#0F6E56] transition self-center shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
