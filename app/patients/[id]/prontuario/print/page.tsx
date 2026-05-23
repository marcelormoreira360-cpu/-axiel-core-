import { notFound } from "next/navigation";
import { getPatientById } from "@/services/patient-service";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getCurrentClinic } from "@/services/clinic-service";

type Props = { params: Promise<{ id: string }> };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const SOAP_LABELS: Record<string, string> = {
  subjective:      "S — Subjetivo",
  objective:       "O — Objetivo",
  assessment_note: "A — Avaliação",
  plan:            "P — Plano",
};

export default async function ProntuarioPrintPage({ params }: Props) {
  const { id } = await params;
  // A-06: scope getPatientById to the caller's clinic
  const clinic = await getCurrentClinic();
  const [patient, sessionRecords, appointments] = await Promise.all([
    getPatientById(id, clinic?.id),
    getSessionRecordsByPatient(id),
    getAppointmentsByPatient(id),
  ]);

  if (!patient) notFound();

  const apptMap = new Map(appointments.map((a) => [a.id, a]));
  const sorted = [...sessionRecords].sort(
    (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
  );
  const printedAt = new Date().toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <title>Prontuário — {patient.full_name}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Georgia, serif; font-size: 11pt; color: #111; background: white; }
          .page { max-width: 780px; margin: 0 auto; padding: 40px 48px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 20px; }
          .clinic-name { font-size: 15pt; font-weight: bold; }
          .print-date { font-size: 9pt; color: #666; text-align: right; }
          .patient-section { margin-bottom: 24px; }
          .patient-name { font-size: 17pt; font-weight: bold; margin-bottom: 8px; }
          .patient-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .meta-item label { font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; color: #888; display: block; }
          .meta-item span { font-size: 10pt; font-weight: 600; }
          .patient-notes { margin-top: 10px; font-size: 10pt; color: #555; white-space: pre-line; }
          .section-title { font-size: 9pt; text-transform: uppercase; letter-spacing: .1em; color: #888; font-weight: bold; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; margin-bottom: 14px; }
          .session { margin-bottom: 24px; page-break-inside: avoid; }
          .session-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
          .session-date { font-size: 12pt; font-weight: bold; }
          .session-meta { font-size: 9pt; color: #888; }
          .soap-badge { font-size: 8pt; background: #e8f5f0; color: #085041; padding: 2px 7px; border-radius: 10px; font-weight: bold; }
          .soap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
          .soap-field { border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 10px; }
          .soap-label { font-size: 8pt; text-transform: uppercase; letter-spacing: .07em; color: #888; font-weight: bold; margin-bottom: 4px; }
          .soap-value { font-size: 10pt; white-space: pre-line; line-height: 1.5; }
          .free-notes { font-size: 10pt; line-height: 1.6; white-space: pre-line; margin-bottom: 8px; }
          .obs-title { font-size: 8pt; text-transform: uppercase; letter-spacing: .07em; color: #888; font-weight: bold; margin-bottom: 4px; }
          .obs-list { display: flex; flex-wrap: wrap; gap: 5px; }
          .obs-tag { font-size: 9pt; background: #f4f3ef; padding: 2px 8px; border-radius: 10px; }
          .session-divider { border: none; border-top: 1px dashed #e0e0e0; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 8pt; color: #aaa; display: flex; justify-content: space-between; }
          .no-print { display: flex; align-items: center; gap: 6px; padding: 10px 0 0 0; font-size: 11pt; color: #555; text-decoration: none; cursor: pointer; background: none; border: none; }
          .no-print:hover { color: #0F1A2E; }
          @media print {
            body { font-size: 10pt; }
            .page { padding: 20px 24px; }
            @page { margin: 1.5cm; }
            .no-print { display: none !important; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          {/* Back button — hidden when printing */}
          <a href={`/patients/${id}`} className="no-print">
            ← Voltar ao prontuário
          </a>

          {/* Header */}
          <div className="header">
            <div>
              <div className="clinic-name">{clinic?.name ?? "Clínica"}</div>
              <div style={{ fontSize: "9pt", color: "#888", marginTop: "2px" }}>Prontuário Eletrônico</div>
            </div>
            <div className="print-date">
              <div>Impresso em {printedAt}</div>
              <div style={{ marginTop: "2px" }}>Total de sessões: {sorted.length}</div>
            </div>
          </div>

          {/* Patient info */}
          <div className="patient-section">
            <div className="patient-name">{patient.full_name}</div>
            <div className="patient-meta">
              <div className="meta-item">
                <label>Data de nascimento</label>
                <span>{patient.date_of_birth ? formatDate(patient.date_of_birth) : "—"}</span>
              </div>
              <div className="meta-item">
                <label>Telefone</label>
                <span>{patient.phone ?? "—"}</span>
              </div>
              <div className="meta-item">
                <label>E-mail</label>
                <span>{patient.email ?? "—"}</span>
              </div>
            </div>
            {patient.notes && (
              <div className="patient-notes" style={{ marginTop: "10px" }}>
                <strong>Observações:</strong> {patient.notes}
              </div>
            )}
          </div>

          {/* Sessions */}
          <div className="section-title">Histórico de sessões</div>

          {sorted.length === 0 && (
            <p style={{ color: "#aaa", fontStyle: "italic" }}>Nenhum registro de sessão.</p>
          )}

          {sorted.map((rec, index) => {
            const appt = apptMap.get(rec.appointment_id) ?? rec.appointments;
            const sessionDate = appt
              ? formatDateTime((appt as { starts_at: string }).starts_at)
              : formatDateTime(rec.updated_at);
            const durationMin = (appt as { duration_minutes?: number })?.duration_minutes;

            const hasSoap =
              rec.soap_mode &&
              [rec.subjective, rec.objective, rec.assessment_note, rec.plan].some(Boolean);

            return (
              <div key={rec.id}>
                <div className="session">
                  <div className="session-header">
                    <div>
                      <span className="session-date">{sessionDate}</span>
                      {durationMin && (
                        <span className="session-meta" style={{ marginLeft: "8px" }}>
                          {durationMin} min
                        </span>
                      )}
                    </div>
                    {hasSoap && <span className="soap-badge">SOAP</span>}
                  </div>

                  {hasSoap && (
                    <div className="soap-grid">
                      {(["subjective", "objective", "assessment_note", "plan"] as const).map((key) => {
                        const value = rec[key];
                        if (!value) return null;
                        return (
                          <div key={key} className="soap-field">
                            <div className="soap-label">{SOAP_LABELS[key]}</div>
                            <div className="soap-value">{value}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {rec.notes && (
                    <div className="free-notes">
                      {hasSoap && <strong style={{ fontSize: "8pt", textTransform: "uppercase", letterSpacing: ".05em", color: "#888" }}>Notas adicionais<br /></strong>}
                      {rec.notes}
                    </div>
                  )}

                  {rec.key_observations?.length > 0 && (
                    <div>
                      <div className="obs-title">Observações-chave</div>
                      <div className="obs-list">
                        {rec.key_observations.map((obs, i) => (
                          <span key={i} className="obs-tag">{obs}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {index < sorted.length - 1 && <hr className="session-divider" />}
              </div>
            );
          })}

          {/* Footer */}
          <div className="footer">
            <span>{clinic?.name ?? "Clínica"} · Documento gerado pelo AXIEL Core</span>
            <span>{patient.full_name} · {sorted.length} sessão(ões)</span>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: "window.onload = () => window.print();" }} />
      </body>
    </html>
  );
}
