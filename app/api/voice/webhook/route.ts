import { NextRequest, NextResponse } from "next/server";
import { validateTwilioSignature } from "@/lib/webhook-guard";
import { buildSystemPrompt, IFWC_DEFAULT_CONFIG, getWhatsAppBotConfigByNumber } from "@/services/whatsapp-bot-service";

export const runtime = "nodejs";

// ─── Voice / language config ─────────────────────────────────────────────────

// Amazon Polly Neural voices via Twilio (best quality, no extra cost)
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

const GREETING: Record<string, string> = {
  "pt-BR": "Olá! Bem-vindo. Como posso ajudá-lo hoje?",
  "pt-PT": "Olá! Bem-vindo. Como posso ajudá-lo hoje?",
  "en-US": "Hello! Welcome. How can I help you today?",
};

const NO_SPEECH: Record<string, string> = {
  "pt-BR": "Não ouvi nada. Até logo!",
  "pt-PT": "Não ouvi nada. Até logo!",
  "en-US": "I did not hear anything. Goodbye!",
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

// Encode conversation history as a compact base64url string for URL params.
// We only carry the last 6 messages (~3 turns) to keep URLs short.
export function encodeHistory(messages: Array<{ role: string; content: string }>): string {
  return Buffer.from(JSON.stringify(messages.slice(-6))).toString("base64url");
}

// ─── Incoming call handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-twilio-signature");
    const host = req.headers.get("host") ?? "";
    const url = `https://${host}${req.nextUrl.pathname}`;

    const params: Record<string, string> = {};
    new URLSearchParams(rawBody).forEach((v, k) => { params[k] = v; });

    if (!validateTwilioSignature(signature, url, params)) {
      console.warn("Voice webhook: invalid Twilio signature");
      return new NextResponse("Forbidden", { status: 403 });
    }

    const toNumber = (params["To"] ?? "").replace("whatsapp:", "");

    // Load clinic config; fall back to IFWC default
    let config = IFWC_DEFAULT_CONFIG;
    try {
      const clinicConfig = toNumber ? await getWhatsAppBotConfigByNumber(toNumber) : null;
      if (clinicConfig) config = clinicConfig;
    } catch { /* ignore, use default */ }

    const lang = config.language ?? "pt-BR";
    const voice = POLLY_VOICE[lang] ?? "Polly.Camila-Neural";
    const gatherLang = GATHER_LANG[lang] ?? "pt-BR";

    // Empty history for this new call
    const historyEncoded = encodeHistory([]);
    const gatherAction = `https://${host}/api/voice/gather?lang=${encodeURIComponent(lang)}&h=${historyEncoded}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${gatherLang}">${xmlEscape(GREETING[lang] ?? GREETING["pt-BR"])}</Say>
  <Gather input="speech" action="${xmlEscape(gatherAction)}" method="POST"
          language="${gatherLang}" speechTimeout="auto" timeout="10">
  </Gather>
  <Say voice="${voice}" language="${gatherLang}">${xmlEscape(NO_SPEECH[lang] ?? NO_SPEECH["pt-BR"])}</Say>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    });
  } catch (err) {
    console.error("Voice webhook error:", err);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="pt-BR">Desculpe, ocorreu um erro. Tente novamente mais tarde.</Say></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }
}

export async function GET() {
  return new NextResponse("OK", { status: 200 });
}
