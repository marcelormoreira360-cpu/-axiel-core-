import type { AiInsightOutput, NeuroProtocoloSuplementacao } from "@/lib/types";
import { getPatientById } from "@/services/patient-service";
import { writeAuditLog } from "@/services/audit-service";
import { getLatestFinalAiInsight } from "@/services/ai-insight/insight-repository";
import { getLatestNeuroIdMap } from "@/services/neuro-id-service";
import { needsEmotionalSafeguard } from "@/modules/ai-insights/neuro-enums";
import { hasPersuasiveDoc1 } from "@/modules/ai-insights/patient-text-guardrails";
import { buildNeuroIdDoc1Pdf, buildNeuroIdPatientReportPdf, buildNeuroIdSupplementPdf } from "@/services/neuro-id-pdf-service";
import { getSupplementCatalog, resolveSupplementCountry } from "@/services/supplement-service";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Envia ao PACIENTE (e-mail + WhatsApp, best-effort) o RELATÓRIO DO PACIENTE
 * (Documento 1 + Documento 2 fundidos) do insight aprovado. Usa o MESMO
 * renderizador persuasivo do download manual (`buildNeuroIdDoc1Pdf`), de modo
 * que o que chega ao paciente é idêntico ao que o profissional vê na tela.
 *
 * A Suplementação (Documento 3) é enviada por um fluxo próprio, separado, pois
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
  const map = await getLatestNeuroIdMap(patientId);
  const mapa = out.mapa_integrativo ?? null;
  const showSafeguard = needsEmotionalSafeguard(map?.emocional_pct ?? null);

  let pdfBuffer: Buffer | null = null;
  let pdfSignedUrl: string | null = null;
  const pdfFilename = `relatorio-neuro-id-${patientId.slice(0, 8)}.pdf`;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const admin = createSupabaseAdminClient();

    // Marca da clínica para o PDF (logo, cor, rodapé configurável).
    let clinicBrand: { name?: string | null; logoUrl?: string | null; primaryColor?: string | null; tagline?: string | null } = {};
    try {
      const { data: clinic } = await admin
        .from("clinics")
        .select("name, logo_url, primary_color, report_tagline")
        .eq("id", insight.clinic_id)
        .single();
      if (clinic) clinicBrand = { name: clinic.name, logoUrl: clinic.logo_url, primaryColor: clinic.primary_color, tagline: clinic.report_tagline };
    } catch { /* sem marca: usa defaults */ }

    if (mapa && hasPersuasiveDoc1(mapa)) {
      pdfBuffer = await buildNeuroIdDoc1Pdf({
        mapa,
        bio3: map ?? null,
        plano: out.plano_regulacao ?? null,
        patientName: patient.full_name ?? null,
        clinic: clinicBrand,
        showSafeguard,
      });
    } else if (map) {
      pdfBuffer = await buildNeuroIdPatientReportPdf({
        map,
        patientName: patient.full_name ?? null,
        clinic: clinicBrand,
        showSafeguard,
        vars: { q1: patient.chief_complaint ?? null, q2: null, sintoma: patient.chief_complaint ?? null },
      });
    } else {
      // Sem Doc 1 persuasivo e sem Mapa Bio³: não há relatório do paciente a enviar.
      return result;
    }

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
    // Falha ao gerar/subir o PDF: sem relatório para enviar.
    if (!pdfBuffer) return result;
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
        attachments: pdfBuffer ? [{ filename: pdfFilename, content: pdfBuffer }] : undefined,
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

  return result;
}

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

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
  if (!protocolo || !protocolo.itens?.some((it) => it.nome?.trim())) return result;

  const patient = await getPatientById(patientId);
  if (!patient) return result;

  const country = resolveSupplementCountry(patient.country, patient.locale);
  const firstName = (patient.full_name ?? "").trim().split(/\s+/)[0] || "";

  // EUA: casa cada item sem link com o catálogo da clínica (por nome) para puxar o
  // buy_url do profissional. Brasil: fórmula manipulada, sem link.
  // storeUrl = link ÚNICO da loja (o paciente clica um só link); derivado de
  // qualquer buy_url do catálogo, tirando o "/products/<slug>".
  let enriched: NeuroProtocoloSuplementacao = protocolo;
  let storeUrl: string | null = null;
  if (country === "US") {
    const catalog = await getSupplementCatalog(patient.clinic_id, { activeOnly: true }).catch(() => []);
    const withUrl = catalog.filter((c) => c.country === "US" && c.buy_url);
    const byName = new Map(withUrl.map((c) => [norm(c.name), c.buy_url as string]));
    const anyUrl = withUrl[0]?.buy_url ?? undefined;
    storeUrl = anyUrl ? anyUrl.split("/products/")[0] : null;
    enriched = {
      ...protocolo,
      itens: protocolo.itens.map((it) => ({ ...it, buy_url: it.buy_url?.trim() || byName.get(norm(it.nome)) || undefined })),
    };
  }

  let pdfBuffer: Buffer | null = null;
  let pdfSignedUrl: string | null = null;
  const pdfFilename = `suplementacao-${patientId.slice(0, 8)}.pdf`;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const admin = createSupabaseAdminClient();

    let clinicBrand: { name?: string | null; logoUrl?: string | null; primaryColor?: string | null; tagline?: string | null } = {};
    try {
      const { data: clinic } = await admin
        .from("clinics")
        .select("name, logo_url, primary_color, report_tagline")
        .eq("id", insight.clinic_id)
        .single();
      if (clinic) clinicBrand = { name: clinic.name, logoUrl: clinic.logo_url, primaryColor: clinic.primary_color, tagline: clinic.report_tagline };
    } catch { /* sem marca: usa defaults */ }

    pdfBuffer = await buildNeuroIdSupplementPdf({ protocolo: enriched, country, patientName: patient.full_name ?? null, clinic: clinicBrand, storeUrl });

    const path = `reports/${patientId}/suplementacao-${insight.id}.pdf`;
    const up = await admin.storage.from("patient-docs").upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (!up.error) {
      const signed = await admin.storage.from("patient-docs").createSignedUrl(path, 60 * 60 * 24 * 7);
      pdfSignedUrl = signed.data?.signedUrl ?? null;
    }
  } catch {
    if (!pdfBuffer) return result;
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
        attachments: pdfBuffer ? [{ filename: pdfFilename, content: pdfBuffer }] : undefined,
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
