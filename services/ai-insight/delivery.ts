import type { AiInsightOutput, NeuroRelatorioHipersensibilidade } from "@/lib/types";
import { getPatientById } from "@/services/patient-service";
import { writeAuditLog } from "@/services/audit-service";
import { getLatestFinalAiInsight } from "@/services/ai-insight/insight-repository";
import { renderPatientReportPdf, renderSupplementPdf, renderHypersensitivityPdf } from "@/services/ai-insight/pdf-download";
import { resolveSupplementCountry } from "@/services/supplement-service";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Envia ao PACIENTE (e-mail + WhatsApp, best-effort) o RELATÓRIO DO PACIENTE
 * (Documento 1 + Documento 2 fundidos) do insight aprovado. Usa o MESMO
 * renderizador persuasivo do download manual (`buildNeuroIdDoc1Pdf`), de modo
 * que o que chega ao paciente é idêntico ao que o profissional vê na tela.
 *
 * A Suplementação (Documento 2) é enviada por um fluxo próprio, separado, pois
 * cada documento tem seu próprio editar/aprovar/enviar.
 */
export type InsightDeliveryChannel = "sent" | "skipped_no_contact" | "failed" | "no_report";
export type InsightDeliveryResult = {
  email: InsightDeliveryChannel;
  whatsapp: InsightDeliveryChannel;
  emailError?: string;
  whatsappError?: string;
};

export async function sendApprovedInsightToPatient(patientId: string): Promise<InsightDeliveryResult> {
  const result: InsightDeliveryResult = { email: "no_report", whatsapp: "no_report" };

  const insight = await getLatestFinalAiInsight(patientId);
  if (!insight) return result;
  const out = (insight.final_output ?? insight.output) as AiInsightOutput;
  if (!out) return result;

  const patient = await getPatientById(patientId);
  if (!patient) return result;

  const firstName = (patient.full_name ?? "").trim().split(/\s+/)[0] || "";
  const safety = (out.safety_note ?? "").trim();

  // ── Gera o PDF do RELATÓRIO DO PACIENTE (Doc 1 + Doc 2 fundidos) ───────────
  // Mesma lógica da rota "Ver PDF" e do botão "Enviar ao paciente" do Mapa Bio³:
  // Doc 1 aprovado no formato persuasivo → relatório completo; senão → por scores.
  // PDF do relatório (Doc 1 + Doc 2 fundidos) pela FONTE ÚNICA compartilhada com o
  // download manual (services/ai-insight/pdf-download.ts): o que o paciente recebe é
  // idêntico ao que o profissional baixa/vê.
  let rendered;
  try {
    rendered = await renderPatientReportPdf(insight, patient);
  } catch {
    return result; // falha ao construir o PDF: degrada para no_report (não derruba a ação/cron)
  }
  if (!rendered) return result; // sem Doc 1 persuasivo e sem Mapa Bio³: nada a enviar
  const pdfBuffer: Buffer = rendered.buffer;
  const pdfFilename = rendered.filename;
  let pdfSignedUrl: string | null = null;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const admin = createSupabaseAdminClient();
    // Upload no bucket privado + URL assinada (o Twilio busca a mídia ao enviar).
    const path = `reports/${patientId}/neuro-id-${insight.id}.pdf`;
    const up = await admin.storage.from("patient-docs").upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (!up.error) {
      const signed = await admin.storage.from("patient-docs").createSignedUrl(path, 60 * 60 * 24 * 7); // 7 dias
      pdfSignedUrl = signed.data?.signedUrl ?? null;
    }
  } catch {
    // Upload/Storage falhou: segue com o anexo por e-mail; WhatsApp cai no fallback de texto.
  }

  // E-mail — o PDF é o entregável; o corpo é uma mensagem curta.
  if (patient.email) {
    try {
      const { sendSimpleEmail } = await import("@/services/email-service");
      const html =
        `<p>Olá${firstName ? `, ${firstName}` : ""}!</p>` +
        `<p>Seu profissional revisou e aprovou o seu relatório de acompanhamento. O relatório completo segue em anexo (PDF).</p>` +
        (safety ? `<p style="color:#6B6A66;font-size:12px;margin-top:16px">${escHtml(safety)}</p>` : "");
      await sendSimpleEmail({
        to: patient.email,
        subject: "Seu relatório de acompanhamento",
        html,
        attachments: [{ filename: pdfFilename, content: pdfBuffer }],
      });
      result.email = "sent";
    } catch (e) {
      result.email = "failed";
      result.emailError = e instanceof Error ? e.message : String(e);
    }
  } else {
    result.email = "skipped_no_contact";
  }

  // WhatsApp — envia o PDF como anexo (mídia) + texto curto.
  if (patient.phone) {
    try {
      const caption =
        `Olá${firstName ? `, ${firstName}` : ""}! Seu profissional aprovou o seu relatório de acompanhamento.` +
        ` O documento completo está anexado abaixo em PDF.` +
        (safety ? `\n\n${safety}` : "");
      if (pdfSignedUrl) {
        const { sendWhatsAppMedia } = await import("@/services/whatsapp-service");
        await sendWhatsAppMedia(patient.phone, caption, pdfSignedUrl);
      } else {
        // Fallback: sem PDF/Storage, manda ao menos o aviso por texto.
        const { sendWhatsAppText } = await import("@/services/whatsapp-service");
        await sendWhatsAppText(
          patient.phone,
          caption + (patient.email ? `\n\n📄 O relatório completo foi enviado para o seu e-mail.` : ""),
        );
      }
      result.whatsapp = "sent";
    } catch (e) {
      result.whatsapp = "failed";
      result.whatsappError = e instanceof Error ? e.message : String(e);
    }
  } else {
    result.whatsapp = "skipped_no_contact";
  }

  // Registro permanente para auditoria/verificação.
  try {
    await writeAuditLog({
      clinicId: insight.clinic_id,
      action: "ai_insight.report_sent",
      entityType: "ai_insight",
      entityId: insight.id,
      metadata: {
        patient_id: patientId,
        email: result.email,
        whatsapp: result.whatsapp,
        email_error: result.emailError ?? null,
        whatsapp_error: result.whatsappError ?? null,
        to_email: patient.email ?? null,
        to_phone: patient.phone ?? null,
      },
    });
  } catch { /* auditoria não deve quebrar o envio */ }

  // Jornada (Frente C): se o relatório chegou ao paciente (e-mail OU WhatsApp),
  // registra report_delivered. Dedup pelo insight → reenvios não duplicam o marco.
  if (result.email === "sent" || result.whatsapp === "sent") {
    try {
      const { emitJourneyEvent } = await import("@/services/journey-events-service");
      await emitJourneyEvent({
        clinicId: insight.clinic_id,
        patientId,
        eventType: "report_delivered",
        actorType: "staff",
        refTable: "ai_insights",
        refId: insight.id,
        dedupKey: `core:ai_insight:${insight.id}:report_delivered`,
        payload: { email: result.email, whatsapp: result.whatsapp },
      });
    } catch { /* jornada é best-effort, nunca quebra o envio */ }
  }

  return result;
}


/**
 * Envia ao PACIENTE (e-mail + WhatsApp, best-effort) o DOCUMENTO 3 — Protocolo de
 * Suplementação — como um PDF PRÓPRIO, separado do relatório. Sensível ao país:
 * BR = fórmula manipulada (sem link); US = suplementos com o link de compra do
 * profissional (do item ou casado com o catálogo) + aviso de que o link é sugestão.
 * Envio só ocorre por ação explícita do profissional (gate de aprovação humana).
 */
export async function sendSupplementToPatient(patientId: string): Promise<InsightDeliveryResult> {
  const result: InsightDeliveryResult = { email: "no_report", whatsapp: "no_report" };

  const insight = await getLatestFinalAiInsight(patientId);
  if (!insight) return result;
  const out = (insight.final_output ?? insight.output) as AiInsightOutput;
  const protocolo = out?.protocolo_suplementacao;
  const hasItens = !!protocolo?.itens?.some((it) => it.nome?.trim());
  const hasFormulas = !!protocolo?.formulas?.some((f) => f.nome?.trim() || f.composicao?.length);
  if (!protocolo || (!hasItens && !hasFormulas)) return result;

  const patient = await getPatientById(patientId);
  if (!patient) return result;

  const country = resolveSupplementCountry(patient.country, patient.locale);
  const firstName = (patient.full_name ?? "").trim().split(/\s+/)[0] || "";

  // PDF da Suplementação pela FONTE ÚNICA (pdf-download.ts): enriquecimento US
  // (catálogo/link ÚNICO da loja) e marca idênticos ao download manual do profissional.
  let rendered;
  try {
    rendered = await renderSupplementPdf(insight, patient);
  } catch {
    return result; // falha ao construir o PDF: degrada para no_report (não derruba a ação/cron)
  }
  if (!rendered) return result;
  const pdfBuffer: Buffer = rendered.buffer;
  const pdfFilename = rendered.filename;
  let pdfSignedUrl: string | null = null;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const admin = createSupabaseAdminClient();
    const path = `reports/${patientId}/suplementacao-${insight.id}.pdf`;
    const up = await admin.storage.from("patient-docs").upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (!up.error) {
      const signed = await admin.storage.from("patient-docs").createSignedUrl(path, 60 * 60 * 24 * 7);
      pdfSignedUrl = signed.data?.signedUrl ?? null;
    }
  } catch {
    // Upload/Storage falhou: segue com anexo por e-mail; WhatsApp cai no fallback de texto.
  }

  const bodyIntro =
    country === "US"
      ? `Hi${firstName ? `, ${firstName}` : ""}! Your practitioner approved your supplement suggestions. The document is attached (PDF).`
      : `Olá${firstName ? `, ${firstName}` : ""}! Seu profissional aprovou a sua sugestão de suplementação. O documento segue em anexo (PDF).`;

  if (patient.email) {
    try {
      const { sendSimpleEmail } = await import("@/services/email-service");
      await sendSimpleEmail({
        to: patient.email,
        subject: country === "US" ? "Your supplement suggestions" : "Sua suplementação",
        html: `<p>${escHtml(bodyIntro)}</p>`,
        attachments: [{ filename: pdfFilename, content: pdfBuffer }],
      });
      result.email = "sent";
    } catch (e) {
      result.email = "failed";
      result.emailError = e instanceof Error ? e.message : String(e);
    }
  } else {
    result.email = "skipped_no_contact";
  }

  if (patient.phone) {
    try {
      if (pdfSignedUrl) {
        const { sendWhatsAppMedia } = await import("@/services/whatsapp-service");
        await sendWhatsAppMedia(patient.phone, bodyIntro, pdfSignedUrl);
      } else {
        const { sendWhatsAppText } = await import("@/services/whatsapp-service");
        await sendWhatsAppText(patient.phone, bodyIntro + (patient.email ? `\n\n📄 ${country === "US" ? "Also sent to your e-mail." : "Também enviado ao seu e-mail."}` : ""));
      }
      result.whatsapp = "sent";
    } catch (e) {
      result.whatsapp = "failed";
      result.whatsappError = e instanceof Error ? e.message : String(e);
    }
  } else {
    result.whatsapp = "skipped_no_contact";
  }

  try {
    await writeAuditLog({
      clinicId: insight.clinic_id,
      action: "ai_insight.supplement_sent",
      entityType: "ai_insight",
      entityId: insight.id,
      metadata: {
        patient_id: patientId,
        country,
        email: result.email,
        whatsapp: result.whatsapp,
        email_error: result.emailError ?? null,
        whatsapp_error: result.whatsappError ?? null,
      },
    });
  } catch { /* auditoria não deve quebrar o envio */ }

  return result;
}

/**
 * Envia ao PACIENTE (e-mail + WhatsApp, best-effort) o DOCUMENTO 3 — Relatório de
 * Hipersensibilidade (exame de cabelo) — como um PDF PRÓPRIO, separado. Só existe
 * quando o insight tem relatorio_hipersensibilidade (paciente fez o teste capilar).
 * Envio só ocorre por ação explícita do profissional (gate de aprovação humana).
 */
export async function sendHypersensitivityToPatient(patientId: string): Promise<InsightDeliveryResult> {
  const result: InsightDeliveryResult = { email: "no_report", whatsapp: "no_report" };

  const insight = await getLatestFinalAiInsight(patientId);
  if (!insight) return result;
  const out = (insight.final_output ?? insight.output) as AiInsightOutput;
  const relatorio: NeuroRelatorioHipersensibilidade | undefined = out?.relatorio_hipersensibilidade;
  const hasContent = !!relatorio && (
    (relatorio.achados_prioritarios?.length ?? 0) > 0 ||
    (relatorio.retirada_alta?.length ?? 0) > 0 ||
    (relatorio.padroes?.length ?? 0) > 0 ||
    (relatorio.fases?.length ?? 0) > 0
  );
  if (!relatorio || !hasContent) return result;

  const patient = await getPatientById(patientId);
  if (!patient) return result;

  const country = resolveSupplementCountry(patient.country, patient.locale);
  const firstName = (patient.full_name ?? "").trim().split(/\s+/)[0] || "";

  // PDF de Hipersensibilidade pela FONTE ÚNICA (pdf-download.ts): idêntico ao download manual.
  let rendered;
  try {
    rendered = await renderHypersensitivityPdf(insight, patient);
  } catch {
    return result; // falha ao construir o PDF: degrada para no_report (não derruba a ação/cron)
  }
  if (!rendered) return result;
  const pdfBuffer: Buffer = rendered.buffer;
  const pdfFilename = rendered.filename;
  let pdfSignedUrl: string | null = null;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const admin = createSupabaseAdminClient();
    const path = `reports/${patientId}/hipersensibilidade-${insight.id}.pdf`;
    const up = await admin.storage.from("patient-docs").upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (!up.error) {
      const signed = await admin.storage.from("patient-docs").createSignedUrl(path, 60 * 60 * 24 * 7);
      pdfSignedUrl = signed.data?.signedUrl ?? null;
    }
  } catch {
    // Upload/Storage falhou: segue com anexo por e-mail; WhatsApp cai no fallback de texto.
  }

  const bodyIntro =
    country === "US"
      ? `Hi${firstName ? `, ${firstName}` : ""}! Your practitioner approved your hypersensitivity report. The document is attached (PDF).`
      : `Olá${firstName ? `, ${firstName}` : ""}! Seu profissional aprovou o seu relatório de hipersensibilidade. O documento segue em anexo (PDF).`;

  if (patient.email) {
    try {
      const { sendSimpleEmail } = await import("@/services/email-service");
      await sendSimpleEmail({
        to: patient.email,
        subject: country === "US" ? "Your hypersensitivity report" : "Seu relatório de hipersensibilidade",
        html: `<p>${escHtml(bodyIntro)}</p>`,
        attachments: [{ filename: pdfFilename, content: pdfBuffer }],
      });
      result.email = "sent";
    } catch (e) {
      result.email = "failed";
      result.emailError = e instanceof Error ? e.message : String(e);
    }
  } else {
    result.email = "skipped_no_contact";
  }

  if (patient.phone) {
    try {
      if (pdfSignedUrl) {
        const { sendWhatsAppMedia } = await import("@/services/whatsapp-service");
        await sendWhatsAppMedia(patient.phone, bodyIntro, pdfSignedUrl);
      } else {
        const { sendWhatsAppText } = await import("@/services/whatsapp-service");
        await sendWhatsAppText(patient.phone, bodyIntro + (patient.email ? `\n\n📄 ${country === "US" ? "Also sent to your e-mail." : "Também enviado ao seu e-mail."}` : ""));
      }
      result.whatsapp = "sent";
    } catch (e) {
      result.whatsapp = "failed";
      result.whatsappError = e instanceof Error ? e.message : String(e);
    }
  } else {
    result.whatsapp = "skipped_no_contact";
  }

  try {
    await writeAuditLog({
      clinicId: insight.clinic_id,
      action: "ai_insight.hypersensitivity_sent",
      entityType: "ai_insight",
      entityId: insight.id,
      metadata: {
        patient_id: patientId,
        email: result.email,
        whatsapp: result.whatsapp,
        email_error: result.emailError ?? null,
        whatsapp_error: result.whatsappError ?? null,
      },
    });
  } catch { /* auditoria não deve quebrar o envio */ }

  return result;
}
