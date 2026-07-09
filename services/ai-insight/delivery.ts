import type { AiInsightOutput } from "@/lib/types";
import { getPatientById } from "@/services/patient-service";
import { patientIdentificacao } from "@/lib/patient-demographics";
import { writeAuditLog } from "@/services/audit-service";
import { getLatestFinalAiInsight } from "@/services/ai-insight/insight-repository";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Monta os 3 documentos do Neuro ID 360 em HTML + texto. Fallback no resumo se não houver docs. */
function formatApprovedReport(out: AiInsightOutput): { html: string; text: string } | null {
  const m = out.mapa_integrativo, p = out.plano_regulacao, s = out.protocolo_suplementacao;
  const hasDocs = !!(m || p || s);

  const htmlParts: string[] = [];
  const textParts: string[] = [];
  const secH = (title: string, items?: string[]) => {
    if (!items?.length) return;
    htmlParts.push(`<p style="font-weight:600;margin:12px 0 2px">${escHtml(title)}</p><ul>${items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</ul>`);
    textParts.push(`${title}:\n` + items.map((i) => `• ${i}`).join("\n"));
  };
  const parH = (title: string, text?: string) => {
    if (!text?.trim()) return;
    htmlParts.push(`<p style="font-weight:600;margin:12px 0 2px">${escHtml(title)}</p><p>${escHtml(text)}</p>`);
    textParts.push(`${title}:\n${text}`);
  };
  const docTitle = (t: string) => { htmlParts.push(`<h2 style="margin-top:20px">${escHtml(t)}</h2>`); textParts.push(`\n=== ${t} ===`); };
  const leadH = (title: string, items?: Array<{ titulo: string; descricao: string }>, numbered?: boolean) => {
    const arr = (items ?? []).filter((it) => it.titulo || it.descricao);
    if (!arr.length) return;
    htmlParts.push(`<p style="font-weight:600;margin:12px 0 2px">${escHtml(title)}</p>` +
      arr.map((it, i) => `<p style="margin:4px 0"><b>${escHtml((numbered ? `${i + 1}. ` : "") + it.titulo)}</b>${it.descricao ? ` — ${escHtml(it.descricao)}` : ""}</p>`).join(""));
    textParts.push(`${title}:\n` + arr.map((it, i) => `${numbered ? `${i + 1}. ` : "• "}${it.titulo}${it.descricao ? ` — ${it.descricao}` : ""}`).join("\n"));
  };

  if (m) {
    docTitle("Relatório Funcional Integrado — Neuro ID");
    parH("Exames e informações avaliadas", m.exames_avaliados ?? m.leitura_integrativa);
    if (m.resultados_encontrados?.length) leadH("Resultados encontrados", m.resultados_encontrados);
    else {
      secH("Principais achados", m.principais_achados);
      secH("Padrões observados", m.padroes_observados);
      secH("Achados funcionais", m.achados_funcionais);
      secH("Desregulação do sistema nervoso", m.desregulacao_sna);
    }
    parH("Síntese clínico-funcional", m.sintese_clinico_funcional);
    parH("Conclusão funcional", m.conclusao_funcional);
    parH("Fase na Jornada Neuro ID", m.fase_jornada);
  }
  if (p) {
    docTitle("Plano Integrativo Neuro ID");
    parH("Fase na Jornada Neuro ID", [p.fase_jornada_nome, p.fase_jornada_justificativa].filter(Boolean).join(" — ") || undefined);
    parH("Direção terapêutica", p.direcao_terapeutica);
    if (p.plano_inicial?.length) leadH("Plano integrativo inicial", p.plano_inicial, true);
    else {
      secH("Próximos passos", p.proximos_passos);
      secH("Orientações iniciais", p.orientacoes_iniciais);
      secH("Recomendações de rotina", p.recomendacoes_rotina);
    }
    parH("Acompanhamento da evolução", p.acompanhamento_evolucao);
    parH("Próximo passo", p.proximo_passo);
  }
  if (s && (s.itens.length || s.observacoes_gerais.length)) {
    docTitle("Protocolo de Suplementação");
    s.itens.forEach((it) => {
      const linhas = [it.dose_sugerida && `Dose sugerida: ${it.dose_sugerida}`, it.objetivo && `Objetivo: ${it.objetivo}`, it.observacao && `Obs.: ${it.observacao}`].filter(Boolean) as string[];
      htmlParts.push(`<p style="margin:8px 0 2px"><b>${escHtml(it.nome)}</b><br>${linhas.map(escHtml).join("<br>")}</p>`);
      textParts.push(`• ${it.nome}` + (linhas.length ? `\n  ${linhas.join("\n  ")}` : ""));
    });
    secH("Observações gerais", s.observacoes_gerais);
  }

  if (!hasDocs) {
    // Fallback: resumo simples (insights antigos sem os documentos)
    const ss = out.structured_summary;
    const paras = [ss?.overview, ss?.current_status].filter((x): x is string => !!x && x.trim().length > 0);
    if (paras.length === 0) return null;
    return {
      html: paras.map((x) => `<p>${escHtml(x)}</p>`).join(""),
      text: paras.join("\n\n"),
    };
  }

  return { html: htmlParts.join(""), text: textParts.join("\n\n") };
}

/**
 * Envia ao paciente (e-mail + WhatsApp, best-effort) os documentos do insight aprovado
 * (Mapa Integrativo + Plano de Regulação + Protocolo de Suplementação). Como o envio só
 * ocorre após a APROVAÇÃO do profissional, a suplementação já passou pela aprovação humana.
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

  const report = formatApprovedReport(out);
  if (!report) return result;

  const firstName = (patient.full_name ?? "").trim().split(/\s+/)[0] || "";
  const safety = (out.safety_note ?? "").trim();

  // ── Gera o PDF do relatório (3 documentos) uma única vez ──────────────────
  // Usado como anexo no e-mail e como mídia no WhatsApp.
  let pdfBuffer: Buffer | null = null;
  let pdfSignedUrl: string | null = null;
  const pdfFilename = `relatorio-neuro-id-360-${patientId.slice(0, 8)}.pdf`;
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

    const { buildNeuroId360Pdf } = await import("@/services/insight-pdf-service");
    pdfBuffer = await buildNeuroId360Pdf({ output: out, patientName: patient.full_name, clinic: clinicBrand, demographics: patientIdentificacao(patient) });

    // Upload no bucket privado + URL assinada (o Twilio busca a mídia ao enviar).
    const path = `reports/${patientId}/neuro-id-360-${insight.id}.pdf`;
    const up = await admin.storage.from("patient-docs").upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (!up.error) {
      const signed = await admin.storage.from("patient-docs").createSignedUrl(path, 60 * 60 * 24 * 7); // 7 dias
      pdfSignedUrl = signed.data?.signedUrl ?? null;
    }
  } catch { /* sem PDF: cai no texto/HTML normal abaixo */ }

  // E-mail — anexa o PDF quando disponível.
  if (patient.email) {
    try {
      const { sendSimpleEmail } = await import("@/services/email-service");
      const html =
        `<p>Olá${firstName ? `, ${firstName}` : ""}!</p>` +
        `<p>Seu profissional revisou e aprovou o seu relatório de acompanhamento.` +
        (pdfBuffer ? ` O relatório completo segue em anexo (PDF).` : "") + `</p>` +
        report.html +
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
        ` O documento completo (Neuro ID 360) está anexado abaixo em PDF.` +
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
