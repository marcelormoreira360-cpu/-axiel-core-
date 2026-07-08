import { notFound } from "next/navigation";
import { parseDob } from "@/lib/dob";
import { getPatientById } from "@/services/patient-service";
import { getPatientPrescriptions } from "@/services/exams-service";
import { getCurrentClinic } from "@/services/clinic-service";
import { getCurrentUserProfile } from "@/services/user-service";

type Props = { params: Promise<{ id: string }> };

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function age(dob?: string | null) {
  if (!dob) return null;
  return Math.floor((Date.now() - parseDob(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

export default async function PrescriptionsPrintPage({ params }: Props) {
  const { id } = await params;

  const [patient, prescriptions, clinic, profile] = await Promise.all([
    getPatientById(id),
    getPatientPrescriptions(id),
    getCurrentClinic(),
    getCurrentUserProfile(),
  ]);

  if (!patient) notFound();

  const active = prescriptions.filter((p) => p.is_active);
  const medications = active.filter((p) => p.type === "medication");
  const supplements = active.filter((p) => p.type === "supplement");

  const printedAt = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  const patientAge = age(patient.date_of_birth);
  const practitioner = profile?.full_name ?? "";
  const contactLine = [
    [clinic?.address_line, [clinic?.city, clinic?.state].filter(Boolean).join(" - ")].filter(Boolean).join(", "),
    clinic?.phone,
    clinic?.contact_email,
  ].filter((s) => s && s.trim()).join(" · ");

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <title>Receituário — {patient.full_name}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; background: white; }
          .page { max-width: 720px; margin: 0 auto; padding: 40px 48px; }

          /* Header */
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; margin-bottom: 6px; }
          .brand { display: flex; align-items: center; gap: 14px; }
          .clinic-logo { height: 52px; width: auto; }
          .clinic-name { font-size: 16pt; font-weight: 700; letter-spacing: -.02em; color: #0F1A2E; }
          .clinic-sub { font-size: 9pt; color: #888; margin-top: 2px; }
          .clinic-contact { font-size: 8pt; color: #888; margin-top: 3px; }
          .header-right { text-align: right; font-size: 9pt; color: #888; line-height: 1.6; }
          .divider-thick { border: none; border-top: 2.5px solid #0F1A2E; margin-bottom: 20px; }

          /* Document title */
          .doc-title { font-size: 13pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; text-align: center; margin-bottom: 20px; color: #0F1A2E; }

          /* Patient box */
          .patient-box { border: 1px solid #d8d6d0; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; }
          .patient-name { font-size: 13pt; font-weight: 700; margin-bottom: 6px; }
          .patient-meta { display: flex; gap: 24px; flex-wrap: wrap; }
          .meta-item label { font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: #888; display: block; margin-bottom: 1px; }
          .meta-item span { font-size: 10pt; font-weight: 600; }

          /* Section */
          .section { margin-bottom: 22px; }
          .section-title { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .10em; color: #666; border-bottom: 1px solid #e8e6e2; padding-bottom: 5px; margin-bottom: 12px; }

          /* Item */
          .rx-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; page-break-inside: avoid; }
          .rx-number { font-size: 12pt; font-weight: 700; color: #ccc; min-width: 22px; padding-top: 1px; }
          .rx-body { flex: 1; }
          .rx-name { font-size: 12pt; font-weight: 700; margin-bottom: 2px; }
          .rx-details { font-size: 10pt; color: #444; line-height: 1.5; }
          .rx-notes { font-size: 9.5pt; color: #777; margin-top: 2px; font-style: italic; }

          /* Empty state */
          .empty { font-size: 10pt; color: #aaa; font-style: italic; }

          /* Signature area */
          .signature-area { margin-top: 48px; display: flex; justify-content: flex-end; }
          .signature-block { text-align: center; width: 240px; }
          .signature-line { border-top: 1px solid #111; margin-bottom: 6px; }
          .signature-name { font-size: 10pt; font-weight: 600; }
          .signature-sub { font-size: 8.5pt; color: #888; margin-top: 2px; }

          /* Footer */
          .footer { margin-top: 32px; padding-top: 10px; border-top: 1px solid #e8e6e2; font-size: 8pt; color: #aaa; display: flex; justify-content: space-between; }

          /* Back link — hidden on print */
          .no-print { display: inline-flex; align-items: center; gap: 5px; padding-bottom: 16px; font-size: 11pt; color: #555; text-decoration: none; cursor: pointer; background: none; border: none; }
          .no-print:hover { color: #0F1A2E; }

          @media print {
            body { font-size: 10pt; }
            .page { padding: 20px 24px; }
            @page { margin: 1.5cm; size: A4; }
            .no-print { display: none !important; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">

          {/* Back link */}
          <a href={`/patients/${id}`} className="no-print">← Voltar ao perfil</a>

          {/* Clinic header — papel timbrado */}
          <div className="header">
            <div className="brand">
              {clinic?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clinic.logo_url} alt={clinic?.name ?? ""} className="clinic-logo" />
              )}
              <div>
                <div className="clinic-name">{clinic?.name ?? "Clínica"}</div>
                <div className="clinic-sub">{clinic?.report_tagline?.trim() || "Medicina Integrativa"}</div>
                {contactLine && <div className="clinic-contact">{contactLine}</div>}
              </div>
            </div>
            <div className="header-right">
              <div>{printedAt}</div>
            </div>
          </div>
          <hr className="divider-thick" />

          {/* Document title */}
          <div className="doc-title">Receituário</div>

          {/* Patient info */}
          <div className="patient-box">
            <div className="patient-name">{patient.full_name}</div>
            <div className="patient-meta">
              {patient.date_of_birth && (
                <div className="meta-item">
                  <label>Data de nascimento</label>
                  <span>{formatDate(patient.date_of_birth)}{patientAge ? ` · ${patientAge} anos` : ""}</span>
                </div>
              )}
              {patient.phone && (
                <div className="meta-item">
                  <label>Telefone</label>
                  <span>{patient.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Medications */}
          {medications.length > 0 && (
            <div className="section">
              <div className="section-title">Medicamentos</div>
              {medications.map((rx, i) => (
                <div key={rx.id} className="rx-item">
                  <div className="rx-number">{i + 1}.</div>
                  <div className="rx-body">
                    <div className="rx-name">{rx.name}</div>
                    <div className="rx-details">
                      {[rx.dosage, rx.frequency].filter(Boolean).join(" — ")}
                      {rx.start_date && (
                        <span style={{ color: "#999", marginLeft: "6px" }}>
                          desde {formatDate(rx.start_date)}
                        </span>
                      )}
                    </div>
                    {rx.notes && <div className="rx-notes">{rx.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Supplements */}
          {supplements.length > 0 && (
            <div className="section">
              <div className="section-title">Suplementos e Fitoterápicos</div>
              {supplements.map((rx, i) => (
                <div key={rx.id} className="rx-item">
                  <div className="rx-number">{i + 1}.</div>
                  <div className="rx-body">
                    <div className="rx-name">{rx.name}</div>
                    <div className="rx-details">
                      {[rx.dosage, rx.frequency].filter(Boolean).join(" — ")}
                      {rx.start_date && (
                        <span style={{ color: "#999", marginLeft: "6px" }}>
                          desde {formatDate(rx.start_date)}
                        </span>
                      )}
                    </div>
                    {rx.notes && <div className="rx-notes">{rx.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {active.length === 0 && (
            <p className="empty">Nenhum item prescrito ativo.</p>
          )}

          {/* Signature */}
          <div className="signature-area">
            <div className="signature-block">
              <div className="signature-line" />
              {practitioner && <div className="signature-name">{practitioner}</div>}
              <div className="signature-sub">{clinic?.name ?? "Profissional de Saúde"}</div>
              <div className="signature-sub" style={{ marginTop: "4px" }}>{printedAt}</div>
            </div>
          </div>

          {/* Footer */}
          <div className="footer">
            <span>Gerado pelo AXIEL Core · {clinic?.name ?? ""}</span>
            <span>Válido somente com assinatura do profissional</span>
          </div>

        </div>
        <script dangerouslySetInnerHTML={{ __html: "window.onload = () => window.print();" }} />
      </body>
    </html>
  );
}
