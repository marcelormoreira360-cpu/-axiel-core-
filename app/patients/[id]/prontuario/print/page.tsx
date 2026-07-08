import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPatientById } from "@/services/patient-service";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getCurrentClinic } from "@/services/clinic-service";

type Props = { params: Promise<{ id: string }> };

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function ProntuarioPrintPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("patientProfile.prontuario");
  const locale = await getLocale();
  const soapLabels: Record<string, string> = {
    subjective:      t("printPage.soap.subjective"),
    objective:       t("printPage.soap.objective"),
    assessment_note: t("printPage.soap.assessment"),
    plan:            t("printPage.soap.plan"),
  };
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
  const printedAt = new Date().toLocaleString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const contactLine = [
    [clinic?.address_line, [clinic?.city, clinic?.state].filter(Boolean).join(" - ")].filter(Boolean).join(", "),
    clinic?.phone,
    clinic?.contact_email,
  ].filter((s) => s && s.trim()).join(" · ");

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <title>{t("printPage.docTitle", { name: patient.full_name })}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Georgia, serif; font-size: 11pt; color: #111; background: white; }
          .page { max-width: 780px; margin: 0 auto; padding: 40px 48px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 20px; }
          .brand { display: flex; align-items: center; gap: 14px; }
          .clinic-logo { height: 52px; width: auto; }
          .clinic-name { font-size: 15pt; font-weight: bold; }
          .clinic-tagline { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .12em; color: #888; margin-top: 3px; }
          .clinic-contact { font-size: 8pt; color: #888; margin-top: 3px; }
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
            ← {t("printPage.back")}
          </a>

          {/* Header — papel timbrado */}
          <div className="header">
            <div className="brand">
              {clinic?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clinic.logo_url} alt={clinic?.name ?? ""} className="clinic-logo" />
              )}
              <div>
                <div className="clinic-name">{clinic?.name ?? t("printPage.clinicFallback")}</div>
                {clinic?.report_tagline && <div className="clinic-tagline">{clinic.report_tagline}</div>}
                {contactLine && <div className="clinic-contact">{contactLine}</div>}
                <div style={{ fontSize: "9pt", color: "#888", marginTop: "2px" }}>{t("printPage.electronicRecord")}</div>
              </div>
            </div>
            <div className="print-date">
              <div>{t("printPage.printedAt", { date: printedAt })}</div>
              <div style={{ marginTop: "2px" }}>{t("printPage.totalSessions", { count: sorted.length })}</div>
            </div>
          </div>

          {/* Patient info */}
          <div className="patient-section">
            <div className="patient-name">{patient.full_name}</div>
            <div className="patient-meta">
              <div className="meta-item">
                <label>{t("dob")}</label>
                <span>{patient.date_of_birth ? formatDate(patient.date_of_birth, locale) : "—"}</span>
              </div>
              <div className="meta-item">
                <label>{t("phone")}</label>
                <span>{patient.phone ?? "—"}</span>
              </div>
              <div className="meta-item">
                <label>{t("printPage.email")}</label>
                <span>{patient.email ?? "—"}</span>
              </div>
            </div>
            {patient.notes && (
              <div className="patient-notes" style={{ marginTop: "10px" }}>
                <strong>{t("printPage.notesLabel")}</strong> {patient.notes}
              </div>
            )}
          </div>

          {/* Sessions */}
          <div className="section-title">{t("printPage.sessionHistory")}</div>

          {sorted.length === 0 && (
            <p style={{ color: "#aaa", fontStyle: "italic" }}>{t("printPage.empty")}</p>
          )}

          {sorted.map((rec, index) => {
            const appt = apptMap.get(rec.appointment_id) ?? rec.appointments;
            const sessionDate = appt
              ? formatDateTime((appt as { starts_at: string }).starts_at, locale)
              : formatDateTime(rec.updated_at, locale);
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
                            <div className="soap-label">{soapLabels[key]}</div>
                            <div className="soap-value">{value}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {rec.notes && (
                    <div className="free-notes">
                      {hasSoap && <strong style={{ fontSize: "8pt", textTransform: "uppercase", letterSpacing: ".05em", color: "#888" }}>{t("additionalNotes")}<br /></strong>}
                      {rec.notes}
                    </div>
                  )}

                  {rec.key_observations?.length > 0 && (
                    <div>
                      <div className="obs-title">{t("keyObservations")}</div>
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
            <span>{clinic?.name ?? t("printPage.clinicFallback")} · {t("printPage.generatedBy")}</span>
            <span>{patient.full_name} · {t("printPage.sessionCount", { count: sorted.length })}</span>
          </div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: "window.onload = () => window.print();" }} />
      </body>
    </html>
  );
}
