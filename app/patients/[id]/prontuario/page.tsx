import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, FileText, Video, ExternalLink } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { getPatientById } from "@/services/patient-service";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getZoomRecordingsByAppointments } from "@/services/zoom-service";
import { getCurrentClinic } from "@/services/clinic-service";

type Props = { params: Promise<{ id: string }> };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SOAP_LABELS: Record<string, string> = {
  subjective:      "Subjetivo",
  objective:       "Objetivo",
  assessment_note: "Avaliação",
  plan:            "Plano",
};

export default async function ProntuarioPage({ params }: Props) {
  const { id } = await params;
  // A-06: fetch clinic first so we can scope getPatientById to the caller's clinic
  const clinic = await getCurrentClinic();
  const [patient, sessionRecords, appointments] = await Promise.all([
    getPatientById(id, clinic?.id),
    getSessionRecordsByPatient(id),
    getAppointmentsByPatient(id),
  ]);

  if (!patient) notFound();

  // Zoom recordings keyed by appointment_id
  const apptIds = sessionRecords.map((r) => r.appointment_id);
  const zoomRecordings = await getZoomRecordingsByAppointments(apptIds);
  const recordingsByAppt = new Map<string, typeof zoomRecordings>();
  for (const rec of zoomRecordings) {
    if (!rec.appointment_id) continue;
    if (!recordingsByAppt.has(rec.appointment_id)) recordingsByAppt.set(rec.appointment_id, []);
    recordingsByAppt.get(rec.appointment_id)!.push(rec);
  }

  // Map appointment data by id for quick lookup
  const apptMap = new Map(appointments.map((a) => [a.id, a]));

  // Sort records oldest → newest for timeline
  const sorted = [...sessionRecords].sort(
    (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
  );

  const totalSessions = sessionRecords.length;
  const lastSession = appointments[0] ?? null;

  return (
    <Shell>
      {/* Topbar */}
      <div className="flex items-center gap-3 mb-7 flex-wrap">
        <BackLink
          fallbackHref={`/patients/${id}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </BackLink>
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Prontuário</p>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">
            {patient.full_name}
          </h1>
        </div>
        <Link
          href={`/patients/${id}/prontuario/print`}
          target="_blank"
          className="flex items-center gap-1.5 rounded-lg border border-black/[.10] dark:border-white/[.10] px-3 py-1.5 text-[12px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
        >
          <Printer className="h-3.5 w-3.5" />
          Imprimir
        </Link>
      </div>

      {/* Patient summary */}
      <div className="rounded-2xl border border-black/[.07] bg-white p-5 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Data de nascimento", value: patient.date_of_birth ? formatDate(patient.date_of_birth) : "—" },
            { label: "Telefone", value: patient.phone ?? "—" },
            { label: "Sessões registradas", value: String(totalSessions) },
            { label: "Última sessão", value: lastSession ? formatDate(lastSession.starts_at) : "—" },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] text-[#A09E98] uppercase tracking-[.05em] mb-0.5">{item.label}</p>
              <p className="text-[13px] font-medium text-[#0F1A2E]">{item.value}</p>
            </div>
          ))}
        </div>
        {patient.notes && (
          <div className="mt-4 pt-4 border-t border-black/[.05] dark:border-white/[.06]">
            <p className="text-[10px] text-[#A09E98] uppercase tracking-[.05em] mb-1">Observações gerais</p>
            <p className="text-[12px] text-[#6B6A66] leading-relaxed whitespace-pre-line">{patient.notes}</p>
          </div>
        )}
      </div>

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-black/[.07] bg-white p-8 text-center">
          <FileText className="h-8 w-8 text-[#D3D1C7] dark:text-white/25 mx-auto mb-3" />
          <p className="text-[13px] font-medium text-[#0F1A2E]">Nenhum registro de sessão ainda</p>
          <p className="text-[12px] text-[#A09E98] mt-1">
            As anotações feitas durante as sessões aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-black/[.06] dark:bg-white/[.07]" />

          <div className="space-y-4 pl-10">
            {sorted.map((rec) => {
              const appt = apptMap.get(rec.appointment_id) ?? rec.appointments;
              const sessionDate = appt
                ? formatDateTime((appt as { starts_at: string }).starts_at)
                : formatDateTime(rec.updated_at);

              const hasSoap =
                rec.soap_mode &&
                [rec.subjective, rec.objective, rec.assessment_note, rec.plan].some(Boolean);

              return (
                <div key={rec.id} className="relative">
                  {/* Dot */}
                  <div className="absolute -left-[29px] top-4 h-2.5 w-2.5 rounded-full border-2 border-[#0F6E56] bg-white" />

                  <div className="rounded-2xl border border-black/[.07] bg-white overflow-hidden">
                    {/* Session header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-black/[.05] dark:border-white/[.06] bg-[#FAFAF8]">
                      <div>
                        <p className="text-[12px] font-semibold text-[#0F1A2E]">{sessionDate}</p>
                        {(appt as { duration_minutes?: number })?.duration_minutes && (
                          <p className="text-[11px] text-[#A09E98]">
                            {(appt as { duration_minutes: number }).duration_minutes} min
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasSoap && (
                          <span className="rounded-full bg-[#E1F5EE] dark:bg-[#0F6E56]/20 px-2 py-0.5 text-[10px] font-medium text-[#0F6E56] dark:text-[#9FE1CB]">
                            SOAP
                          </span>
                        )}
                        <Link
                          href={`/schedule/${rec.appointment_id}/session`}
                          className="text-[11px] text-[#A09E98] hover:text-[#0F6E56] dark:hover:text-[#9FE1CB] transition"
                        >
                          Editar
                        </Link>
                      </div>
                    </div>

                    <div className="px-5 py-4 space-y-4">
                      {/* SOAP content */}
                      {hasSoap && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {(["subjective", "objective", "assessment_note", "plan"] as const).map((key) => {
                            const value = rec[key];
                            if (!value) return null;
                            return (
                              <div key={key} className="rounded-xl bg-[#FAFAF8] border border-black/[.05] dark:border-white/[.06] p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-1">
                                  {SOAP_LABELS[key]}
                                </p>
                                <p className="text-[12px] text-[#0F1A2E] leading-relaxed whitespace-pre-line">
                                  {value}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Free text notes */}
                      {rec.notes && (
                        <div>
                          {hasSoap && (
                            <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-1">
                              Notas adicionais
                            </p>
                          )}
                          <p className="text-[12px] text-[#0F1A2E] leading-relaxed whitespace-pre-line">
                            {rec.notes}
                          </p>
                        </div>
                      )}

                      {/* Key observations */}
                      {rec.key_observations?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-2">
                            Observações-chave
                          </p>
                          <ul className="flex flex-wrap gap-1.5">
                            {rec.key_observations.map((obs, i) => (
                              <li
                                key={i}
                                className="rounded-full bg-[#F4F3EF] px-2.5 py-1 text-[11px] text-[#6B6A66]"
                              >
                                {obs}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Empty record */}
                      {!hasSoap && !rec.notes && rec.key_observations?.length === 0 && (
                        <p className="text-[12px] text-[#D3D1C7] dark:text-white/25 italic">Sessão sem anotações.</p>
                      )}

                      {/* Zoom recordings */}
                      {(recordingsByAppt.get(rec.appointment_id) ?? []).length > 0 && (
                        <div className="pt-2 border-t border-black/[.05] dark:border-white/[.06]">
                          <p className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-2">
                            Gravações
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(recordingsByAppt.get(rec.appointment_id) ?? []).map((zr) => (
                              <div key={zr.id} className="flex items-center gap-1.5">
                                <Video className="h-3 w-3 text-[#0F6E56] dark:text-[#9FE1CB]" />
                                {zr.play_url ? (
                                  <a
                                    href={zr.play_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] dark:text-[#9FE1CB] hover:underline"
                                  >
                                    {zr.file_type === "MP4" ? "Vídeo" : zr.file_type === "M4A" ? "Áudio" : zr.file_type ?? "Arquivo"}
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-[11px] text-[#A09E98]">
                                    {zr.file_type ?? "Arquivo"}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Shell>
  );
}
