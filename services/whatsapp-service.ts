import twilio from "twilio";

// ─── Shared report type (used by health-agent, WhatsApp send, voice send) ────

export type HealthReportPatient = {
  greeting?: string | null;
  overall_message?: string | null;
  positive_points?: string[];
  attention_areas?: { area: string; explanation: string; action: string }[];
  next_steps?: string[];
  encouragement?: string | null;
};

export type HealthReport = {
  patient: HealthReportPatient;
  [key: string]: unknown;
};

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Credenciais Twilio não configuradas");
  return twilio(sid, token);
}

function getFrom() {
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) throw new Error("TWILIO_FROM_NUMBER não configurado");
  return from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
}

export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const client = getClient();
  const e164 = to.startsWith("whatsapp:") || to.startsWith("+") ? to : `+${to}`;
  const toNumber = e164.startsWith("whatsapp:") ? e164 : `whatsapp:${e164}`;
  await client.messages.create({ from: getFrom(), to: toNumber, body });
}

export async function sendWhatsAppMedia(to: string, body: string, mediaUrl: string): Promise<void> {
  const client = getClient();
  const e164 = to.startsWith("whatsapp:") || to.startsWith("+") ? to : `+${to}`;
  const toNumber = e164.startsWith("whatsapp:") ? e164 : `whatsapp:${e164}`;
  await client.messages.create({ from: getFrom(), to: toNumber, body, mediaUrl: [mediaUrl] });
}

export function formatReportForWhatsApp(patientName: string, report: HealthReport): string {
  const p = report.patient;
  const firstName = patientName.split(" ")[0];
  const lines: string[] = [];

  lines.push(`*${p.greeting ?? `Olá, ${firstName}`}*`);
  lines.push("");
  lines.push(p.overall_message ?? "");

  if (p.positive_points?.length) {
    lines.push("");
    lines.push("✅ *Pontos positivos*");
    for (const pt of p.positive_points) lines.push(`• ${pt}`);
  }

  if (p.attention_areas?.length) {
    lines.push("");
    lines.push("📌 *Áreas de atenção*");
    for (const a of p.attention_areas) {
      lines.push(`*${a.area}*`);
      lines.push(a.explanation);
      lines.push(`→ ${a.action}`);
    }
  }

  if (p.next_steps?.length) {
    lines.push("");
    lines.push("🎯 *Próximos passos*");
    p.next_steps.forEach((s: string, i: number) => lines.push(`${i + 1}. ${s}`));
  }

  if (p.encouragement) {
    lines.push("");
    lines.push(`_"${p.encouragement}"_`);
  }

  lines.push("");
  lines.push("_Este relatório foi gerado por IA e não substitui avaliação médica._");

  return lines.join("\n");
}

export function formatReportForTTS(report: HealthReport): string {
  const p = report.patient;
  const parts: string[] = [];

  if (p.greeting) parts.push(p.greeting);
  if (p.overall_message) parts.push(p.overall_message);

  if (p.positive_points?.length) {
    parts.push("Seus pontos positivos são:");
    for (const pt of p.positive_points) parts.push(pt);
  }

  if (p.attention_areas?.length) {
    parts.push("Áreas que merecem atenção:");
    for (const a of p.attention_areas) {
      parts.push(`${a.area}. ${a.explanation}. O que você pode fazer: ${a.action}`);
    }
  }

  if (p.next_steps?.length) {
    parts.push("Seus próximos passos são:");
    p.next_steps.forEach((s: string, i: number) => parts.push(`${i + 1}: ${s}`));
  }

  if (p.encouragement) parts.push(p.encouragement);

  return parts.join(". ");
}
