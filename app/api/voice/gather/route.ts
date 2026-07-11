import { NextRequest, NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/webhook-guard";
import { buildSystemPrompt, IFWC_DEFAULT_CONFIG, getWhatsAppBotConfigByNumber } from "@/services/whatsapp-bot-service";
import { createLogger } from "@/lib/logger";

const log = createLogger("voice-gather");

export const runtime = "nodejs";

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };

// ─── Voice / language config ─────────────────────────────────────────────────

const POLLY_VOICE: Record<string, string> = {
  "pt-BR": "Polly.Camila-Neural",
  "pt-PT": "Polly.Ines-Neural",
  "en-US": "Polly.Joanna-Neural",
};

const GATHER_LANG: Record<string, string> = {
  "pt-BR": "pt-BR",
  "pt-PT": "pt-PT",
  "en-US": "en-US",
};

const VOICE_INSTRUCTION: Record<string, string> = {
  "pt-BR": "\n\n─── FORMATO PARA LIGAÇÃO ───\nVocê está em uma chamada telefônica ao vivo. Responda em no máximo 2 frases curtas e diretas. Sem emojis, sem listas, sem markdown. Fale de forma natural como em uma ligação real. Seja caloroso mas conciso.",
  "pt-PT": "\n\n─── FORMATO PARA LIGAÇÃO ───\nEstá numa chamada telefónica. Responda em no máximo 2 frases curtas e directas. Sem emojis, sem listas. Fale de forma natural.",
  "en-US": "\n\nVOICE CALL FORMAT: You are on a live phone call. Keep responses to 2 short sentences maximum. No emojis, no lists, no markdown. Speak naturally and warmly.",
};

const RETRY_MSG: Record<string, string> = {
  "pt-BR": "Não consegui entender. Pode repetir?",
  "pt-PT": "Não percebi. Pode repetir?",
  "en-US": "I did not catch that. Could you repeat?",
};

const FAREWELL: Record<string, string> = {
  "pt-BR": "Obrigado por ligar. Até logo!",
  "pt-PT": "Obrigado por ligar. Até logo!",
  "en-US": "Thank you for calling. Goodbye!",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function encodeHistory(messages: ChatMessage[]): string {
  return Buffer.from(JSON.stringify(messages.slice(-6))).toString("base64url");
}

function decodeHistory(encoded: string): ChatMessage[] {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
  } catch {
    return [];
  }
}

// ─── AI reply ────────────────────────────────────────────────────────────────

async function generateVoiceReply(
  userMessage: string,
  history: ChatMessage[],
  systemPrompt: string,
  lang: string,
  apiKey: string
): Promise<string> {
  const voicePrompt = systemPrompt + (VOICE_INSTRUCTION[lang] ?? VOICE_INSTRUCTION["pt-BR"]);

  const messages = [
    { role: "system" as const, content: voicePrompt },
    ...history.slice(-8),
    { role: "user" as const, content: userMessage },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages,
      temperature: 0.65,
      max_tokens: 180, // keep voice responses short
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    log.error("Voice AI error", { status: res.status, data: JSON.stringify(data) });
    return "";
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Gather handler (called after each speech input) ─────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-BR">Serviço temporariamente indisponível.</Say></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-twilio-signature");
    const host = req.headers.get("host") ?? "";

    // IMPORTANT: URL for signature validation must match exactly what Twilio called,
    // including the query string we embedded in the <Gather action="..."> attribute.
    const url = `https://${host}${req.nextUrl.pathname}${req.nextUrl.search}`;

    const params: Record<string, string> = {};
    new URLSearchParams(rawBody).forEach((v, k) => { params[k] = v; });

    if (!validateTwilioSignature(signature, url, params)) {
      log.warn("invalid Twilio signature");
      return new NextResponse("Forbidden", { status: 403 });
    }

    // State from query params (passed via <Gather action> URL)
    const lang = req.nextUrl.searchParams.get("lang") ?? "pt-BR";
    const historyEncoded = req.nextUrl.searchParams.get("h") ?? "";
    const history = decodeHistory(historyEncoded);

    const voice = POLLY_VOICE[lang] ?? "Polly.Camila-Neural";
    const gatherLang = GATHER_LANG[lang] ?? "pt-BR";
    const speechResult = params["SpeechResult"]?.trim() ?? "";
    const toNumber = (params["To"] ?? "").replace("whatsapp:", "");

    // ── No speech detected ──────────────────────────────────────────────────
    if (!speechResult) {
      const retryEncoded = encodeHistory(history);
      const retryAction = `https://${host}/api/voice/gather?lang=${encodeURIComponent(lang)}&h=${retryEncoded}`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${gatherLang}">${xmlEscape(RETRY_MSG[lang] ?? RETRY_MSG["pt-BR"])}</Say>
  <Gather input="speech" action="${xmlEscape(retryAction)}" method="POST"
          language="${gatherLang}" speechTimeout="auto" timeout="10">
  </Gather>
  <Say voice="${voice}" language="${gatherLang}">${xmlEscape(FAREWELL[lang] ?? FAREWELL["pt-BR"])}</Say>
</Response>`;
      return new NextResponse(twiml, { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } });
    }

    // ── Load clinic config ──────────────────────────────────────────────────
    // Isolação multi-tenant vem da resolução por número (uma 2ª clínica que
    // cadastra o próprio número de voz resolve para a config dela).
    let config = IFWC_DEFAULT_CONFIG;
    try {
      const clinicConfig = toNumber ? await getWhatsAppBotConfigByNumber(toNumber) : null;
      if (clinicConfig) config = clinicConfig;
    } catch { /* fall back to default */ }

    const systemPrompt = buildSystemPrompt(config);

    // ── Generate AI reply ───────────────────────────────────────────────────
    const reply = await generateVoiceReply(speechResult, history, systemPrompt, lang, apiKey);
    const finalReply = reply || (lang === "en-US" ? "Could you repeat that?" : "Pode repetir, por favor?");

    // ── Update history and prepare next gather ──────────────────────────────
    const updatedHistory: ChatMessage[] = [
      ...history,
      { role: "user", content: speechResult },
      { role: "assistant", content: finalReply },
    ];

    const nextEncoded = encodeHistory(updatedHistory);
    const nextAction = `https://${host}/api/voice/gather?lang=${encodeURIComponent(lang)}&h=${nextEncoded}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${gatherLang}">${xmlEscape(finalReply)}</Say>
  <Gather input="speech" action="${xmlEscape(nextAction)}" method="POST"
          language="${gatherLang}" speechTimeout="auto" timeout="10">
  </Gather>
  <Say voice="${voice}" language="${gatherLang}">${xmlEscape(FAREWELL[lang] ?? FAREWELL["pt-BR"])}</Say>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  } catch (err) {
    log.error("error", err);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-BR">Desculpe, ocorreu um erro. Tente novamente.</Say></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }
}

export async function GET() {
  return new NextResponse("OK", { status: 200 });
}
