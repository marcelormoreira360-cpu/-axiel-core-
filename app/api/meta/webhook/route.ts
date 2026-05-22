import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateMetaSignature, checkRateLimit } from "@/lib/webhook-guard";

export const runtime = "nodejs";

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string };

type MetaPlatform = "messenger" | "instagram";

// ─── Conversation History ─────────────────────────────────────────────────────

async function getHistory(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  senderId: string,
  platform: MetaPlatform
): Promise<{ id: string | null; messages: ChatMessage[]; botDisabled: boolean }> {
  try {
    const { data } = await supabase
      .from("meta_conversations")
      .select("id, messages, bot_disabled")
      .eq("sender_id", senderId)
      .eq("platform", platform)
      .maybeSingle();
    return {
      id: data?.id ?? null,
      messages: (data?.messages as ChatMessage[]) ?? [],
      botDisabled: data?.bot_disabled ?? false,
    };
  } catch {
    return { id: null, messages: [], botDisabled: false };
  }
}

async function saveHistory(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  senderId: string,
  platform: MetaPlatform,
  id: string | null,
  messages: ChatMessage[]
) {
  const payload = {
    sender_id: senderId,
    platform,
    messages: messages.slice(-30),
    updated_at: new Date().toISOString(),
  };
  try {
    if (id) {
      await supabase.from("meta_conversations").update(payload).eq("id", id);
    } else {
      await supabase.from("meta_conversations").insert(payload);
    }
  } catch {
    // non-blocking
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(platform: MetaPlatform): string {
  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://axiel-core-6ikl.vercel.app"}/book/ifwc`;
  const channel = platform === "instagram" ? "Instagram" : "Messenger";

  return `Você é a assistente virtual da Dra. Dayane Moreira, especialista em saúde integrativa pelo Método Neuro ID.
Você atende via ${channel} de forma calorosa, empática e profissional, sempre em português.

## Seu objetivo
Conduzir a conversa de forma natural até o agendamento de uma consulta inicial. Seu funil é:
1. Acolher e entender a queixa/necessidade do cliente
2. Apresentar brevemente o método e seus benefícios
3. Responder dúvidas sobre preço, funcionamento, formato
4. Oferecer o agendamento com link direto
5. Confirmar e fechar

## Informações que você pode fornecer
- **Método Neuro ID**: abordagem integrativa que combina neurociência, nutrição funcional e medicina do estilo de vida
- **Consultas**: online e presencial, individuais
- **Foco**: fadiga, ansiedade, distúrbios do sono, desequilíbrios hormonais, saúde digestiva, performance cognitiva
- **Agendamento**: ${bookingUrl}
- Para valores e disponibilidade específicos, informe que a própria Dra. Dayane responderá em breve, mas já ofereça o link de agendamento

## Regras
- Seja breve nas respostas (máx 3 parágrafos curtos)
- Nunca invente valores ou diagnósticos
- Se a pessoa disser que quer agendar, envie o link de agendamento diretamente
- Se a pessoa pedir para falar com humano ou com a médica, responda com empatia e diga que a Dra. Dayane entrará em contato, mas já ofereça o link
- Sempre termine com uma pergunta aberta ou call-to-action suave para manter a conversa fluindo
- Não repita a mesma mensagem de boas-vindas se já houve troca anterior`;
}

// ─── AI Reply ─────────────────────────────────────────────────────────────────

async function generateReply(
  incomingMessage: string,
  history: ChatMessage[],
  platform: MetaPlatform,
  apiKey: string
): Promise<string> {
  const messages = [
    { role: "system" as const, content: buildSystemPrompt(platform) },
    ...history.slice(-16),
    { role: "user" as const, content: incomingMessage },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages,
      temperature: 0.65,
      max_tokens: 500,
    }),
  });

  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  if (!res.ok) {
    console.error("OpenAI error:", res.status, JSON.stringify(data));
    return "";
  }
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── Send Message via Graph API ───────────────────────────────────────────────

async function sendMetaMessage(
  recipientId: string,
  text: string,
  pageAccessToken: string,
  platform: MetaPlatform
) {
  // Both Messenger and Instagram use the same endpoint
  const url = "https://graph.facebook.com/v21.0/me/messages";

  const res = await fetch(`${url}?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error(`Meta send error (${platform}):`, JSON.stringify(err));
  }
}

// ─── Webhook Verification (GET) ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// ─── Token resolver ───────────────────────────────────────────────────────────

function resolvePageToken(pageId: string): string {
  const tokenMap: Record<string, string> = {
    [process.env.META_PAGE_ID_1 ?? ""]: process.env.META_PAGE_ACCESS_TOKEN ?? "",
    [process.env.META_PAGE_ID_2 ?? ""]: process.env.META_PAGE_ACCESS_TOKEN_2 ?? "",
  };
  return tokenMap[pageId] ?? process.env.META_PAGE_ACCESS_TOKEN ?? "";
}

// ─── Webhook Handler (POST) ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("Missing OPENAI_API_KEY");
    return new NextResponse("OK", { status: 200 });
  }

  let body: Record<string, unknown>;

  try {
    const rawBody = Buffer.from(await req.arrayBuffer());
    const signature = req.headers.get("x-hub-signature-256");

    if (!validateMetaSignature(signature, rawBody)) {
      console.warn("Meta webhook: invalid signature — rejected");
      return new NextResponse("Forbidden", { status: 403 });
    }

    body = JSON.parse(rawBody.toString("utf-8")) as Record<string, unknown>;
  } catch (err) {
    console.error("Meta webhook: failed to parse body", err);
    return new NextResponse("OK", { status: 200 });
  }

  // Determine platform
  const platform: MetaPlatform =
    body.object === "instagram" ? "instagram" : "messenger";

  const entries = (body.entry as Record<string, unknown>[]) ?? [];

  for (const entry of entries) {
    const pageId = (entry.id as string) ?? "";
    const pageAccessToken = resolvePageToken(pageId);

    // Messenger uses entry.messaging; Instagram DMs use entry.changes[].value.messages
    const messagingEvents: Record<string, unknown>[] =
      (entry.messaging as Record<string, unknown>[]) ??
      ((entry.changes as { value?: { messages?: unknown[] } }[]) ?? [])
        .flatMap((c) => (c.value?.messages as Record<string, unknown>[]) ?? []);

    for (const event of messagingEvents) {
      // ── Skip echo messages (page's own outgoing messages reflected back) ──
      const msg = event.message as Record<string, unknown> | undefined;
      if (msg?.is_echo === true) continue;

      // ── Extract text ──
      const messageText: string | null =
        (msg?.text as string | undefined) ??
        ((event.value as { messages?: { text?: { body?: string } }[] } | undefined)
          ?.messages?.[0]?.text?.body) ??
        null;

      // ── Extract sender ID ──
      const senderId: string | null =
        ((event.sender as { id?: string } | undefined)?.id) ??
        ((event.value as { messages?: { from?: string }[] } | undefined)
          ?.messages?.[0]?.from) ??
        null;

      if (!senderId || !messageText?.trim()) continue;

      // ── Rate limiting ──
      if (!checkRateLimit(`meta:${senderId}`)) {
        console.warn(`Meta webhook: rate limit hit for sender ${senderId}`);
        continue;
      }

      const supabase = createSupabaseAdminClient();

      // ── Get conversation history ──
      const { id: convId, messages: history, botDisabled } = await getHistory(
        supabase,
        senderId,
        platform
      );

      // If a human has taken over, skip AI
      if (botDisabled) continue;

      // ── Generate AI reply ──
      const reply = await generateReply(messageText, history, platform, apiKey);
      const finalReply =
        reply ||
        "Olá! Obrigada pela mensagem. 😊 Como posso ajudar você hoje?";

      // ── Persist history ──
      const updatedMessages: ChatMessage[] = [
        ...history,
        { role: "user", content: messageText },
        { role: "assistant", content: finalReply },
      ];
      void saveHistory(supabase, senderId, platform, convId, updatedMessages);

      // ── Send reply ──
      await sendMetaMessage(senderId, finalReply, pageAccessToken, platform);
    }
  }

  return new NextResponse("OK", { status: 200 });
}
