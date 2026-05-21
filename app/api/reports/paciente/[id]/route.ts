import PDFDocument from "pdfkit";
import { getCurrentClinic } from "@/services/clinic-service";
import { getPatientById } from "@/services/patient-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getPatientPrescriptions } from "@/services/exams-service";
import { getAiInsightsByPatient } from "@/services/ai-insight-service";

export const runtime = "nodejs";

function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function divider(doc: PDFKit.PDFDocument) {
  doc.moveDown(0.5);
  doc.strokeColor("#e5e7eb").lineWidth(0.5).moveTo(56, doc.y).lineTo(556, doc.y).stroke();
  doc.moveDown(0.5);
}

function sectionHeading(doc: PDFKit.PDFDocument, title: string) {
  divider(doc);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12).text(title);
  doc.moveDown(0.4);
}

function ptDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ptDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  const [patient, appointments, prescriptions, insights] = await Promise.all([
    getPatientById(id),
    getAppointmentsByPatient(id),
    getPatientPrescriptions(id),
    getAiInsightsByPatient(id, 3),
  ]);

  if (!patient) return new Response("Paciente não encontrado", { status: 404 });
  if (patient.clinic_id !== clinic.id) return new Response("Forbidden", { status: 403 });

  const doc = new PDFDocument({
    margin: 56,
    size: "A4",
    info: {
      Title: `Resumo — ${patient.full_name}`,
      Author: clinic.name,
    },
  });

  // ── Header bar ──
  doc.rect(0, 0, 595, 80).fill("#0B1F3A");
  doc.fillColor("white").font("Helvetica-Bold").fontSize(16).text(clinic.name, 56, 22);
  doc
    .fillColor("rgba(255,255,255,0.6)")
    .font("Helvetica")
    .fontSize(10)
    .text("Resumo do Paciente", 56, 44);
  doc
    .fillColor("rgba(255,255,255,0.4)")
    .fontSize(9)
    .text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 56, 58);
  doc.y = 100;

  // ── Patient identity block ──
  const age =
    patient.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)
        )
      : null;

  const blockY = doc.y;
  doc.rect(56, blockY, 487, age !== null ? 88 : 72).fillColor("#f9fafb").fill();
  doc.rect(56, blockY, 3, age !== null ? 88 : 72).fillColor("#0B1F3A").fill();

  doc
    .fillColor("#111827")
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(patient.full_name, 68, blockY + 10, { width: 470 });

  let metaY = blockY + 32;
  const meta: string[] = [];
  if (patient.email) meta.push(`E-mail: ${patient.email}`);
  if (patient.phone) meta.push(`Telefone: ${patient.phone}`);
  if (patient.date_of_birth) meta.push(`Data de nascimento: ${ptDate(patient.date_of_birth)}${age !== null ? ` (${age} anos)` : ""}`);
  meta.push(`Status: ${patient.status === "active" ? "Ativo" : patient.status === "inactive" ? "Inativo" : "Arquivado"}`);
  meta.push(`Cadastrado em: ${ptDate(patient.created_at)}`);

  meta.forEach((line) => {
    doc
      .fillColor("#374151")
      .font("Helvetica")
      .fontSize(9)
      .text(line, 68, metaY, { width: 460 });
    metaY += 13;
  });

  doc.y = blockY + (age !== null ? 88 : 72) + 10;

  // ── Notes ──
  if (patient.notes) {
    sectionHeading(doc, "Observações Gerais");
    doc.fillColor("#374151").font("Helvetica").fontSize(9).text(patient.notes, 56, doc.y, {
      width: 487,
      lineGap: 2,
    });
    doc.moveDown(0.5);
  }

  // ── Sessions ──
  sectionHeading(doc, `Histórico de Sessões (${appointments.length})`);

  if (appointments.length === 0) {
    doc
      .fillColor("#9ca3af")
      .font("Helvetica")
      .fontSize(9)
      .text("Nenhuma sessão registrada.", 56, doc.y);
    doc.moveDown(0.5);
  } else {
    const cols = [
      { x: 56, w: 100, label: "Data / Hora" },
      { x: 160, w: 180, label: "Tipo de sessão" },
      { x: 344, w: 60, label: "Duração" },
      { x: 408, w: 135, label: "Observações" },
    ];
    const hY = doc.y;
    doc.rect(56, hY, 487, 18).fillColor("#f3f4f6").fill();
    cols.forEach((c) => {
      doc
        .fillColor("#6b7280")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(c.label, c.x + 4, hY + 5, { width: c.w - 4 });
    });
    doc.y = hY + 22;

    const sorted = [...appointments].sort(
      (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
    );

    sorted.slice(0, 60).forEach((appt, i) => {
      if (doc.y > 740) doc.addPage();
      const rowY = doc.y;
      if (i % 2 === 0) doc.rect(56, rowY - 2, 487, 16).fillColor("#fafafa").fill();

      const sessionTypeName = (appt as { session_types?: { name?: string } | null }).session_types?.name ?? "—";
      const notesSnippet = appt.notes ? appt.notes.slice(0, 50) + (appt.notes.length > 50 ? "…" : "") : "—";

      doc.fillColor("#374151").font("Helvetica").fontSize(8);
      doc.text(ptDateTime(appt.starts_at), 60, rowY, { width: 96 });
      doc.text(sessionTypeName, 164, rowY, { width: 176 });
      doc.text(`${appt.duration_minutes} min`, 348, rowY, { width: 56 });
      doc.text(notesSnippet, 412, rowY, { width: 127 });
      doc.y = rowY + 16;
    });

    if (appointments.length > 60) {
      doc.moveDown(0.3);
      doc
        .fillColor("#9ca3af")
        .font("Helvetica")
        .fontSize(8)
        .text(`(${appointments.length - 60} sessões adicionais não exibidas)`);
    }
  }

  // ── Active prescriptions ──
  const activePrescriptions = prescriptions.filter((p) => p.is_active);
  const medications = activePrescriptions.filter((p) => p.type === "medication");
  const supplements = activePrescriptions.filter((p) => p.type === "supplement");

  if (activePrescriptions.length > 0) {
    sectionHeading(doc, "Prescrições Ativas");

    const renderRxGroup = (label: string, items: typeof activePrescriptions) => {
      if (items.length === 0) return;
      doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(9).text(label.toUpperCase(), 56, doc.y, {
        characterSpacing: 0.4,
      });
      doc.moveDown(0.3);

      items.forEach((rx, i) => {
        if (doc.y > 740) doc.addPage();
        const rowY = doc.y;
        if (i % 2 === 0) doc.rect(56, rowY - 2, 487, 14).fillColor("#fafafa").fill();

        doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text(rx.name, 60, rowY, {
          continued: true,
          width: 180,
        });
        doc.fillColor("#374151").font("Helvetica").fontSize(9).text("", { continued: false });

        const details: string[] = [];
        if (rx.dosage) details.push(rx.dosage);
        if (rx.frequency) details.push(rx.frequency);
        if (rx.start_date) details.push(`Início: ${ptDate(rx.start_date)}`);
        if (rx.end_date) details.push(`Fim: ${ptDate(rx.end_date)}`);

        if (details.length > 0) {
          doc
            .fillColor("#6b7280")
            .font("Helvetica")
            .fontSize(8)
            .text(details.join("  ·  "), 60, rowY + 11, { width: 480 });
          doc.y = rowY + 24;
        } else {
          doc.y = rowY + 14;
        }
      });
      doc.moveDown(0.3);
    };

    renderRxGroup("Medicamentos", medications);
    renderRxGroup("Suplementos", supplements);
  }

  // ── AI Insights ──
  if (insights.length > 0) {
    sectionHeading(doc, "Insights de IA Recentes");

    insights.forEach((insight) => {
      if (doc.y > 700) doc.addPage();
      const output = insight.final_output ?? insight.output;
      const insightY = doc.y;

      doc.rect(56, insightY, 487, 14).fillColor("#f0fdf4").fill();
      doc
        .fillColor("#065f46")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(ptDate(insight.created_at), 60, insightY + 3, { continued: true, width: 200 });
      doc.fillColor("#374151").font("Helvetica").fontSize(8).text("", { continued: false });
      doc.y = insightY + 16;

      const overview = output.structured_summary?.overview;
      if (overview) {
        doc
          .fillColor("#111827")
          .font("Helvetica")
          .fontSize(9)
          .text(overview.slice(0, 300) + (overview.length > 300 ? "…" : ""), 60, doc.y, {
            width: 480,
            lineGap: 1.5,
          });
        doc.moveDown(0.3);
      }

      if (output.patterns_and_correlations && output.patterns_and_correlations.length > 0) {
        const pattern = output.patterns_and_correlations[0];
        doc
          .fillColor("#374151")
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(`Padrão: ${pattern.title}`, 60, doc.y);
        doc
          .fillColor("#6b7280")
          .font("Helvetica")
          .fontSize(8)
          .text(pattern.insight.slice(0, 200) + (pattern.insight.length > 200 ? "…" : ""), 60, doc.y, {
            width: 480,
            lineGap: 1.5,
          });
        doc.moveDown(0.3);
      }

      doc.moveDown(0.4);
    });
  }

  // ── Footer ──
  doc.moveDown(2);
  doc
    .fillColor("#d1d5db")
    .font("Helvetica")
    .fontSize(8)
    .text(`${clinic.name} · Resumo gerado pelo AXIEL Core · Documento confidencial`, { align: "center" });

  const buffer = await pdfToBuffer(doc);
  const slug = patient.full_name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="paciente-${slug}.pdf"`,
    },
  });
}
