import { describe, it, expect, vi } from "vitest";

// Gate de aprovação humana: as funções de envio ao paciente SÓ podem operar sobre
// um insight com review_status="final". Provamos aqui que, quando não existe insight
// FINAL (ex.: o insight está apenas em pending_review), NENHUM canal é acionado e o
// resultado é "no_report". Mockamos o repositório para simular "sem insight final".
vi.mock("@/services/ai-insight/insight-repository", () => ({
  getLatestFinalAiInsight: vi.fn(async () => null),
}));

// Espiões nos canais de saída: se o gate falhar, algum destes seria chamado.
const sendSimpleEmail = vi.fn(async () => {});
const sendWhatsAppMedia = vi.fn(async () => {});
const sendWhatsAppText = vi.fn(async () => {});
vi.mock("@/services/email-service", () => ({ sendSimpleEmail }));
vi.mock("@/services/whatsapp-service", () => ({ sendWhatsAppMedia, sendWhatsAppText }));

import {
  sendApprovedInsightToPatient,
  sendSupplementToPatient,
  sendHypersensitivityToPatient,
} from "@/services/ai-insight/delivery";

describe("ai-insight delivery — gate de aprovação humana", () => {
  it("não envia o relatório quando não há insight FINAL aprovado (ex.: só pending)", async () => {
    const r = await sendApprovedInsightToPatient("patient-x");
    expect(r.email).toBe("no_report");
    expect(r.whatsapp).toBe("no_report");
  });

  it("não envia suplementação sem insight FINAL", async () => {
    const r = await sendSupplementToPatient("patient-x");
    expect(r.email).toBe("no_report");
    expect(r.whatsapp).toBe("no_report");
  });

  it("não envia hipersensibilidade sem insight FINAL", async () => {
    const r = await sendHypersensitivityToPatient("patient-x");
    expect(r.email).toBe("no_report");
    expect(r.whatsapp).toBe("no_report");
  });

  it("nenhum canal de envio é acionado quando o gate barra", async () => {
    await sendApprovedInsightToPatient("patient-x");
    await sendSupplementToPatient("patient-x");
    await sendHypersensitivityToPatient("patient-x");
    expect(sendSimpleEmail).not.toHaveBeenCalled();
    expect(sendWhatsAppMedia).not.toHaveBeenCalled();
    expect(sendWhatsAppText).not.toHaveBeenCalled();
  });
});
