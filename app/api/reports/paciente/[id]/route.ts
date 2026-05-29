import PDFDocument from "pdfkit";
import { getCurrentClinic } from "@/services/clinic-service";
import { getPatientById } from "@/services/patient-service";
import { getAppointmentsByPatient } from "@/services/appointment-service";
import { getPatientExams, getPatientPrescriptions } from "@/services/exams-service";
import { getAiInsightsByPatient } from "@/services/ai-insight-service";
import { getPatientAssessmentResponses } from "@/services/assessment-service";
import { getSessionRecordsByPatient } from "@/services/session-recording-service";
import { computePatientEngagement } from "@/services/patient-intelligence-service";

export const runtime = "nodejs";

// ── PDF helpers ───────────────────────────────────────────────────────────────

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

function subHeading(doc: PDFKit.PDFDocument, title: string) {
  doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(9).text(title.toUpperCase(), 56, doc.y, {
    characterSpacing: 0.4,
  });
  doc.moveDown(0.3);
}

function pageBreakIfNeeded(doc: PDFKit.PDFDocument, threshold = 740) {
  if (doc.y > threshold) doc.addPage();
}

function ptDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
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

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const clinic = await getCurrentClinic();
  if (!clinic) return new Response("Unauthorized", { status: 401 });

  const [patient, appointments, prescriptions, insights, assessmentResponses, exams, sessionRecords] =
    await Promise.all([
      getPatientById(id),
      getAppointmentsByPatient(id),
      getPatientPrescriptions(id),
      getAiInsightsByPatient(id, 50),          // all insights
      getPatientAssessmentResponses(id),
      getPatientExams(id),
      getSessionRecordsByPatient(id),
    ]);

  if (!patient) return new Response("Paciente não encontrado", { status: 404 });
  if (patient.clinic_id !== clinic.id) return new Response("Forbidden", { status: 403 });

  // Compute intelligence from loaded data
  const engagement = computePatientEngagement(appointments, patient);

  const doc = new PDFDocument({
    margin: 56,
    size: "A4",
    info: {
      Title: `Prontuário Completo — ${patient.full_name}`,
      Author: clinic.name,
      Subject: "Relatório gerado pelo AXIEL Core",
    },
  });

  // ── Cover header ─────────────────────────────────────────────────────────────
  doc.rect(0, 0, 595, 80).fill("#0B1F3A");
  doc.fillColor("white").font("Helvetica-Bold").fontSize(16).text(clinic.name, 56, 22);
  doc.fillColor("rgba(255,255,255,0.6)").font("Helvetica").fontSize(10).text("Prontuário Completo do Paciente", 56, 44);
  doc.fillColor("rgba(255,255,255,0.4)").fontSize(9).text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 56, 58);
  doc.y = 100;

  // ── Patient identity block ────────────────────────────────────────────────────
  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const blockH = 72 + (age !== null ? 13 : 0) + (patient.email ? 13 : 0) + (patient.phone ? 13 : 0);
  const blockY = doc.y;
  doc.rect(56, blockY, 487, blockH).fillColor("#f9fafb").fill();
  doc.rect(56, blockY, 3, blockH).fillColor("#0B1F3A").fill();

  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(15).text(patient.full_name, 68, blockY + 10, { width: 470 });

  let metaY = blockY + 32;
  const metaLines: string[] = [];
  if (patient.email)          metaLines.push(`E-mail: ${patient.email}`);
  if (patient.phone)          metaLines.push(`Telefone: ${patient.phone}`);
  if (patient.date_of_birth)  metaLines.push(`Nascimento: ${ptDate(patient.date_of_birth)}${age !== null ? ` (${age} anos)` : ""}`);
  metaLines.push(`Status: ${patient.status === "active" ? "Ativo" : patient.status === "inactive" ? "Inativo" : "Arquivado"}`);
  metaLines.push(`Cadastrado em: ${ptDate(patient.created_at)}`);

  metaLines.forEach((line) => {
    doc.fillColor("#374151").font("Helvetica").fontSize(9).text(line, 68, metaY, { width: 460 });
    metaY += 13;
  });

  doc.y = blockY + blockH + 10;

  // ── Intelligence metrics strip ────────────────────────────────────────────────
  const RISK_LABEL: Record<string, string> = {
    none:   "Engajado",
    low:    "Atenção",
    medium: "Em risco",
    high:   "Churn provável",
  };
  const RISK_COLOR: Record<string, string> = {
    none:   "#065f46",
    low:    "#92400e",
    medium: "#7c2d12",
    high:   "#991b1b",
  };
  const RISK_BG: Record<string, string> = {
    none:   "#f0fdf4",
    low:    "#fffbeb",
    medium: "#fff7ed",
    high:   "#fef2f2",
  };

  const stripY = doc.y;
  const riskColor  = RISK_COLOR[engagement.churnRisk]  ?? "#374151";
  const riskBg     = RISK_BG[engagement.churnRisk]     ?? "#f9fafb";
  doc.rect(56, stripY, 487, 30).fillColor(riskBg).fill();

  // Score
  doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text("ENGAJAMENTO", 64, stripY + 5);
  doc.fillColor(riskColor).font("Helvetica-Bold").fontSize(12).text(String(engagement.score), 64, stripY + 14, { continued: true });
  doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text("/100", { continued: false });

  // Risk
  doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text("RISCO DE CHURN", 180, stripY + 5);
  doc.fillColor(riskColor).font("Helvetica-Bold").fontSize(10).text(RISK_LABEL[engagement.churnRisk] ?? "—", 180, stripY + 15);

  // Last session
  doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text("ÚLTIMA SESSÃO", 300, stripY + 5);
  const lastSessionText = engagement.daysSinceLastSession === null
    ? "—"
    : engagement.daysSinceLastSession === 0 ? "Hoje"
    : engagement.daysSinceLastSession === 1 ? "Ontem"
    : `${engagement.daysSinceLastSession} dias atrás`;
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text(lastSessionText, 300, stripY + 15);

  // Sessions 90d
  doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text("SESSÕES (90D)", 420, stripY + 5);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text(String(engagement.sessionsLast90Days), 420, stripY + 15);

  doc.y = stripY + 38;

  // ── General notes ─────────────────────────────────────────────────────────────
  if (patient.notes) {
    sectionHeading(doc, "Observações Gerais");
    doc.fillColor("#374151").font("Helvetica").fontSize(9).text(patient.notes, 56, doc.y, {
      width: 487, lineGap: 2,
    });
    doc.moveDown(0.5);
  }

  // ── Session history ───────────────────────────────────────────────────────────
  sectionHeading(doc, `Histórico de Sessões (${appointments.length})`);

  if (appointments.length === 0) {
    doc.fillColor("#9ca3af").font("Helvetica").fontSize(9).text("Nenhuma sessão registrada.", 56, doc.y);
    doc.moveDown(0.5);
  } else {
    const cols = [
      { x: 56,  w: 104, label: "Data / Hora" },
      { x: 164, w: 160, label: "Tipo de sessão" },
      { x: 328, w: 55,  label: "Duração" },
      { x: 387, w: 60,  label: "Status" },
      { x: 451, w: 92,  label: "Observações" },
    ];
    const hY = doc.y;
    doc.rect(56, hY, 487, 18).fillColor("#f3f4f6").fill();
    cols.forEach((c) => {
      doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(8).text(c.label, c.x + 4, hY + 5, { width: c.w - 4 });
    });
    doc.y = hY + 22;

    const STATUS_PT: Record<string, string> = {
      completed: "Concluída",
      scheduled: "Agendada",
      confirmed: "Confirmada",
      cancelled: "Cancelada",
      no_show:   "Faltou",
    };

    const sorted = [...appointments].sort(
      (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
    );

    sorted.slice(0, 60).forEach((appt, i) => {
      pageBreakIfNeeded(doc);
      const rowY = doc.y;
      if (i % 2 === 0) doc.rect(56, rowY - 2, 487, 16).fillColor("#fafafa").fill();

      const stName = (appt as { session_types?: { name?: string } | null }).session_types?.name ?? "—";
      const st = appt.status ?? "scheduled";
      const notesSnip = appt.notes ? appt.notes.slice(0, 35) + (appt.notes.length > 35 ? "…" : "") : "—";

      doc.fillColor("#374151").font("Helvetica").fontSize(8);
      doc.text(ptDateTime(appt.starts_at), 60, rowY, { width: 100 });
      doc.text(stName, 168, rowY, { width: 156 });
      doc.text(`${appt.duration_minutes} min`, 332, rowY, { width: 51 });
      doc.text(STATUS_PT[st] ?? st, 391, rowY, { width: 56 });
      doc.text(notesSnip, 455, rowY, { width: 84 });
      doc.y = rowY + 16;
    });

    if (appointments.length > 60) {
      doc.moveDown(0.3);
      doc.fillColor("#9ca3af").font("Helvetica").fontSize(8)
        .text(`(${appointments.length - 60} sessões adicionais não exibidas)`);
    }
  }

  // ── Session notes (SOAP) ──────────────────────────────────────────────────────
  const recordsWithNotes = sessionRecords.filter(
    (r) => r.notes || r.subjective || r.objective || r.assessment_note || r.plan
  );

  if (recordsWithNotes.length > 0) {
    sectionHeading(doc, `Notas de Sessão (${recordsWithNotes.length})`);

    // Map appointment_id → starts_at for header dates
    const apptMap = new Map(appointments.map((a) => [a.id, a.starts_at]));

    recordsWithNotes.slice(0, 20).forEach((rec) => {
      pageBreakIfNeeded(doc, 700);
      const noteY = doc.y;
      const apptDate = apptMap.get(rec.appointment_id) ?? rec.created_at;

      // Date row
      doc.rect(56, noteY, 487, 14).fillColor("#f0fdf4").fill();
      doc.fillColor("#065f46").font("Helvetica-Bold").fontSize(8)
        .text(`Sessão · ${ptDate(apptDate)}`, 60, noteY + 3);
      doc.y = noteY + 16;

      if (rec.soap_mode) {
        const soapFields: Array<[string, string | null]> = [
          ["Subjetivo", rec.subjective],
          ["Objetivo", rec.objective],
          ["Avaliação", rec.assessment_note],
          ["Plano", rec.plan],
        ];
        soapFields.forEach(([label, value]) => {
          if (!value?.trim()) return;
          pageBreakIfNeeded(doc, 720);
          doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8).text(`${label}: `, 60, doc.y, { continued: true });
          doc.fillColor("#4b5563").font("Helvetica").fontSize(8)
            .text(value.slice(0, 400) + (value.length > 400 ? "…" : ""), { continued: false, width: 470, lineGap: 1.5 });
          doc.moveDown(0.2);
        });
      } else if (rec.notes) {
        doc.fillColor("#4b5563").font("Helvetica").fontSize(8)
          .text(rec.notes.slice(0, 500) + (rec.notes.length > 500 ? "…" : ""), 60, doc.y, { width: 474, lineGap: 1.5 });
      }

      // Vitals
      if (rec.vitals) {
        const v = rec.vitals as Record<string, number | undefined>;
        const vParts: string[] = [];
        const VL: Record<string, string> = { pain: "Dor", energy: "Energia", mood: "Humor", sleep: "Sono" };
        Object.entries(VL).forEach(([k, l]) => { if (v[k] != null) vParts.push(`${l}: ${v[k]}/5`); });
        if (vParts.length > 0) {
          doc.fillColor("#9ca3af").font("Helvetica").fontSize(7.5)
            .text(`Vitais: ${vParts.join("  ·  ")}`, 60, doc.y);
        }
      }

      doc.moveDown(0.5);
    });

    if (recordsWithNotes.length > 20) {
      doc.fillColor("#9ca3af").font("Helvetica").fontSize(8)
        .text(`(${recordsWithNotes.length - 20} notas adicionais não exibidas)`);
    }
  }

  // ── Assessment responses ──────────────────────────────────────────────────────
  if (assessmentResponses.length > 0) {
    sectionHeading(doc, `Formulários Aplicados (${assessmentResponses.length})`);

    const sorted = [...assessmentResponses].sort(
      (a, b) => new Date(b.filled_at).getTime() - new Date(a.filled_at).getTime()
    );

    sorted.forEach((resp, i) => {
      pageBreakIfNeeded(doc);
      const rowY = doc.y;
      if (i % 2 === 0) doc.rect(56, rowY - 2, 487, 22).fillColor("#fafafa").fill();

      const name = resp.assessment_templates?.name ?? "Formulário";
      const pct = resp.score_percentage != null ? Math.round(resp.score_percentage) : null;
      const score = pct != null
        ? `${pct}% (${resp.total_score ?? "?"} / ${resp.max_possible_score ?? "?"})`
        : "Sem pontuação";

      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text(name, 60, rowY, { width: 260 });
      doc.fillColor("#374151").font("Helvetica").fontSize(8).text(ptDate(resp.filled_at), 330, rowY, { width: 100 });
      doc.fillColor(pct != null && pct >= 70 ? "#991b1b" : pct != null && pct >= 40 ? "#92400e" : "#065f46")
        .font("Helvetica-Bold").fontSize(9).text(score, 440, rowY, { width: 100 });

      // Section scores
      if (resp.section_scores && Object.keys(resp.section_scores).length > 0) {
        const sections = Object.values(resp.section_scores);
        const sectionText = sections.map((s) => `${s.title}: ${s.score}/${s.max}`).join("  ·  ");
        doc.fillColor("#9ca3af").font("Helvetica").fontSize(7.5)
          .text(sectionText, 60, rowY + 11, { width: 474 });
        doc.y = rowY + 24;
      } else {
        doc.y = rowY + 22;
      }
    });
  }

  // ── Prescriptions ─────────────────────────────────────────────────────────────
  const activePrescriptions = prescriptions.filter((p) => p.is_active);
  const medications = activePrescriptions.filter((p) => p.type === "medication");
  const supplements  = activePrescriptions.filter((p) => p.type === "supplement");

  if (activePrescriptions.length > 0) {
    sectionHeading(doc, "Prescrições Ativas");

    const renderRxGroup = (label: string, items: typeof activePrescriptions) => {
      if (items.length === 0) return;
      subHeading(doc, label);

      items.forEach((rx, i) => {
        pageBreakIfNeeded(doc);
        const rowY = doc.y;
        if (i % 2 === 0) doc.rect(56, rowY - 2, 487, 14).fillColor("#fafafa").fill();

        doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9)
          .text(rx.name, 60, rowY, { continued: true, width: 200 });
        doc.fillColor("#374151").font("Helvetica").fontSize(9).text("", { continued: false });

        const details: string[] = [];
        if (rx.dosage)     details.push(rx.dosage);
        if (rx.frequency)  details.push(rx.frequency);
        if (rx.start_date) details.push(`Início: ${ptDate(rx.start_date)}`);
        if (rx.end_date)   details.push(`Fim: ${ptDate(rx.end_date)}`);

        if (details.length > 0) {
          doc.fillColor("#6b7280").font("Helvetica").fontSize(8)
            .text(details.join("  ·  "), 60, rowY + 11, { width: 480 });
          doc.y = rowY + 24;
        } else {
          doc.y = rowY + 14;
        }
      });
      doc.moveDown(0.3);
    };

    renderRxGroup("Medicamentos", medications);
    renderRxGroup("Suplementos",  supplements);
  }

  // ── Laboratory exams ──────────────────────────────────────────────────────────
  const examsWithResults = exams.filter((e) => e.exam_results.length > 0);

  if (exams.length > 0) {
    sectionHeading(doc, `Exames Laboratoriais (${exams.length})`);

    const sortedExams = [...exams].sort(
      (a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime()
    );

    sortedExams.forEach((exam) => {
      pageBreakIfNeeded(doc, 700);
      const examY = doc.y;

      // Exam header
      doc.rect(56, examY, 487, 14).fillColor("#f3f4f6").fill();
      doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9)
        .text(`${ptDate(exam.exam_date)}${exam.lab_name ? `  ·  ${exam.lab_name}` : ""}`, 60, examY + 3);
      doc.y = examY + 16;

      if (exam.exam_results.length === 0) {
        doc.fillColor("#9ca3af").font("Helvetica").fontSize(8).text("Sem resultados registrados.", 60, doc.y);
        doc.moveDown(0.4);
        return;
      }

      // Biomarker rows
      exam.exam_results.forEach((r, i) => {
        pageBreakIfNeeded(doc);
        const rY = doc.y;
        if (i % 2 === 0) doc.rect(56, rY - 1, 487, 14).fillColor("#fafafa").fill();

        const STATUS_COLOR: Record<string, string> = { low: "#1d4ed8", high: "#991b1b", normal: "#065f46", unknown: "#6b7280" };
        const STATUS_LABEL: Record<string, string> = { low: "Baixo", high: "Alto", normal: "Normal", unknown: "—" };
        const sc = STATUS_COLOR[r.status] ?? "#374151";

        doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8.5)
          .text(r.biomarker, 60, rY, { width: 180 });
        doc.fillColor("#374151").font("Helvetica").fontSize(8.5)
          .text(`${r.value}${r.unit ? ` ${r.unit}` : ""}`, 248, rY, { width: 80 });

        const ref = r.ref_min != null && r.ref_max != null
          ? `Ref: ${r.ref_min}–${r.ref_max}${r.unit ? ` ${r.unit}` : ""}`
          : "";
        doc.fillColor("#9ca3af").font("Helvetica").fontSize(7.5).text(ref, 340, rY, { width: 130 });
        doc.fillColor(sc).font("Helvetica-Bold").fontSize(8).text(STATUS_LABEL[r.status] ?? "—", 480, rY, { width: 58 });
        doc.y = rY + 14;
      });

      doc.moveDown(0.4);
    });

    if (examsWithResults.length === 0) {
      doc.moveDown(-0.3);
      doc.fillColor("#9ca3af").font("Helvetica").fontSize(8).text("Exames registrados sem resultados de biomarkers.");
      doc.moveDown(0.3);
    }
  }

  // ── AI Insights ───────────────────────────────────────────────────────────────
  const finalInsights = insights.filter((i) => i.review_status === "final");
  const allInsights = finalInsights.length > 0 ? finalInsights : insights;

  if (allInsights.length > 0) {
    sectionHeading(doc, `Insights de IA${finalInsights.length > 0 ? " Aprovados" : " Recentes"} (${allInsights.length})`);

    allInsights.slice(0, 10).forEach((insight) => {
      pageBreakIfNeeded(doc, 700);
      const output = insight.final_output ?? insight.output;
      const insightY = doc.y;

      const statusLabel = { final: "Aprovado", pending_review: "Em revisão", needs_changes: "Ajustes", archived: "Arquivado" };
      doc.rect(56, insightY, 487, 14).fillColor("#f0fdf4").fill();
      doc.fillColor("#065f46").font("Helvetica-Bold").fontSize(8)
        .text(ptDate(insight.created_at), 60, insightY + 3, { continued: true, width: 200 });
      doc.fillColor("#9ca3af").font("Helvetica").fontSize(7.5)
        .text(`  ·  ${statusLabel[insight.review_status] ?? insight.review_status}`, { continued: false });
      doc.y = insightY + 16;

      const overview = output.structured_summary?.overview;
      if (overview) {
        doc.fillColor("#111827").font("Helvetica").fontSize(9)
          .text(overview.slice(0, 400) + (overview.length > 400 ? "…" : ""), 60, doc.y, {
            width: 477, lineGap: 1.5,
          });
        doc.moveDown(0.3);
      }

      // Current status
      const currentStatus = output.structured_summary?.current_status;
      if (currentStatus) {
        doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8).text("Status atual: ", 60, doc.y, { continued: true });
        doc.fillColor("#4b5563").font("Helvetica").fontSize(8)
          .text(currentStatus.slice(0, 250) + (currentStatus.length > 250 ? "…" : ""), { continued: false, width: 464 });
        doc.moveDown(0.2);
      }

      // Patterns (up to 2)
      if (output.patterns_and_correlations?.length) {
        output.patterns_and_correlations.slice(0, 2).forEach((pat) => {
          pageBreakIfNeeded(doc, 720);
          doc.fillColor("#374151").font("Helvetica-Bold").fontSize(8)
            .text(`Padrão: ${pat.title}`, 60, doc.y);
          doc.fillColor("#6b7280").font("Helvetica").fontSize(8)
            .text(pat.insight.slice(0, 250) + (pat.insight.length > 250 ? "…" : ""), 60, doc.y, {
              width: 477, lineGap: 1.5,
            });
          doc.moveDown(0.2);
        });
      }

      // Reviewer notes
      if (insight.reviewer_notes) {
        doc.fillColor("#065f46").font("Helvetica-Bold").fontSize(8)
          .text("Nota do profissional: ", 60, doc.y, { continued: true });
        doc.fillColor("#374151").font("Helvetica").fontSize(8)
          .text(insight.reviewer_notes.slice(0, 200) + (insight.reviewer_notes.length > 200 ? "…" : ""), {
            continued: false, width: 430,
          });
      }

      doc.moveDown(0.6);
    });

    if (allInsights.length > 10) {
      doc.fillColor("#9ca3af").font("Helvetica").fontSize(8)
        .text(`(${allInsights.length - 10} insights adicionais não exibidos)`);
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  doc.moveDown(2);
  doc.fillColor("#d1d5db").font("Helvetica").fontSize(8)
    .text(
      `${clinic.name} · Prontuário gerado pelo AXIEL Core · Documento confidencial — não substitui avaliação clínica`,
      { align: "center" },
    );

  const buffer = await pdfToBuffer(doc);
  const slug = patient.full_name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="paciente-${slug}.pdf"`,
    },
  });
}
