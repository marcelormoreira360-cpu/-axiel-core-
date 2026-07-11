// Chamada ao endpoint chat/completions da OpenAI com TIMEOUT e RETRY/backoff.
// Usada pelos call sites baseados em `fetch`. Os baseados no SDK `openai` já têm
// retry embutido (maxRetries), então usam o SDK diretamente.
//
// IMPORTANTE: o retry é OPT-IN (default `retries: 0`). Os webhooks síncronos de
// conversa (Twilio WhatsApp/SMS, voz, Meta) precisam responder à plataforma
// dentro de ~15s; um retry passaria desse teto e a plataforma descartaria a
// resposta (Twilio) ou reentregaria o evento (Meta, resposta dupla) — foi para
// isso que o timeout de 15s (INT-04) existe. Por isso só as chamadas
// app-iniciadas (health-agent, telehealth) passam `retries` > 0.
//
// Retorna o Response (o chamador trata res.ok/parse). Só faz retry em 429 e 5xx
// (transientes) e em erro de rede/timeout; nunca em 4xx de request.

const CHAT_URL = "https://api.openai.com/v1/chat/completions";

function backoffMs(attempt: number): number {
  // 300ms, 600ms, 1200ms… com teto e jitter para não sincronizar tentativas.
  return Math.min(4000, 300 * 2 ** attempt) + Math.floor(Math.random() * 200);
}

export async function openaiChatCompletion(
  apiKey: string,
  body: Record<string, unknown>,
  opts: { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const retries = opts.retries ?? 0;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify(body),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs(attempt)));
        continue;
      }
      return res;
    } catch (err) {
      // Timeout (AbortSignal) ou falha de rede: tenta de novo, senão propaga.
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, backoffMs(attempt)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
