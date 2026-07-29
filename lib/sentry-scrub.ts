/**
 * Scrubbing de PHI/PII para eventos do Sentry (AXIEL Core).
 *
 * Objetivo: garantir que NENHUM dado de paciente saia daqui para o Sentry.
 * Isso vale para HIPAA/LGPD — e-mail, telefone, nome, data de nascimento,
 * CPF, respostas de questionário, notas clínicas e IDs de paciente em URLs
 * nunca devem aparecer em logs de erro / traces.
 *
 * Estratégia (defesa em profundidade):
 *  1. Denylist de CHAVES: qualquer campo cujo nome bata com a denylist tem o
 *     VALOR trocado por "[redacted]" (ex.: email, phone, full_name, token...).
 *  2. Regex em TEXTO livre: mesmo em campos "inocentes" (message, stack,
 *     query string, path), mascaramos padrões de e-mail, telefone e UUID/token.
 *  3. URLs/paths: segmentos que são UUID ou token (ex.: /patients/<uuid>,
 *     /f/<token>) viram "[id]" / "[token]", e a query string é removida.
 *
 * Este módulo é usado por sentry.server.config.ts, instrumentation.ts (server)
 * e instrumentation-client.ts (browser) — um único ponto de verdade.
 */

import type { Event, Breadcrumb } from "@sentry/nextjs";

// O tipo do bloco request não é exportado com nome próprio; derivamos do Event.
type SentryRequest = NonNullable<Event["request"]>;

const REDACTED = "[redacted]";

/**
 * Chaves cujo VALOR é sempre mascarado.
 * Match case-insensitive: EXATO para chaves genéricas (evita apagar campos de
 * debug tipo "module_name") e por SUBSTRING para chaves inequivocamente sensíveis.
 */
const DENY_KEYS_EXACT = new Set([
  "name",
  "full_name",
  "fullname",
  "first_name",
  "last_name",
  "patient_name",
  "display_name",
  "given_name",
  "family_name",
  "dob",
  "date_of_birth",
  "birth_date",
  "birthdate",
  "cpf",
  "ssn",
  "answers",
  "answer",
  "notes",
  "note",
  "soap",
  "body",
  "content",
  "message_body",
  "address",
  "street",
  "username",
]);

// Se a chave CONTÉM qualquer um destes, o valor é mascarado.
const DENY_KEY_SUBSTRINGS = [
  "email",
  "phone",
  "telefone",
  "whatsapp",
  "token",
  "password",
  "passwd",
  "secret",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "access_key",
  "private_key",
];

// Padrões em texto livre.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
// Telefone: 8+ dígitos, aceitando +, espaços, (), - e . como separadores.
const PHONE_RE = /(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/g;

function keyIsSensitive(key: string): boolean {
  const k = key.toLowerCase();
  if (DENY_KEYS_EXACT.has(k)) return true;
  return DENY_KEY_SUBSTRINGS.some((sub) => k.includes(sub));
}

/** Mascara e-mail, telefone e UUID dentro de uma string de texto livre. */
function scrubString(value: string): string {
  return value
    .replace(EMAIL_RE, "[email]")
    .replace(UUID_RE, "[id]")
    .replace(PHONE_RE, "[phone]");
}

/**
 * Percorre recursivamente um objeto/array mascarando por chave (denylist) e
 * aplicando regex em strings. Protegido contra ciclos e profundidade excessiva.
 */
function scrubValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value == null) return value;
  if (typeof value === "string") return scrubString(value);
  if (typeof value !== "object") return value; // number, boolean, etc.
  if (depth > 8) return REDACTED;

  const obj = value as object;
  if (seen.has(obj)) return REDACTED;
  seen.add(obj);

  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = keyIsSensitive(k) ? REDACTED : scrubValue(v, depth + 1, seen);
  }
  return out;
}

/**
 * Mascara IDs/tokens em um path e REMOVE a query string.
 * Ex.: /patients/3f2b.../edit?token=abc -> /patients/[id]/edit
 *      /f/9aZ...longo -> /f/[token]
 */
function scrubUrl(rawUrl: string): string {
  // Separa a query string (descartada por completo — pode carregar token/e-mail).
  const [pathAndHost] = rawUrl.split("?");

  return pathAndHost
    .split("/")
    .map((seg) => {
      if (!seg) return seg;
      if (UUID_RE.test(seg)) return "[id]";
      // Segmento longo e opaco (token de link mágico, JWT curto, hash) -> [token]
      if (/^[A-Za-z0-9_-]{20,}$/.test(seg)) return "[token]";
      return seg;
    })
    .join("/");
}

/** Aplica scrubbing no bloco request do evento (url, query, body, cookies, headers). */
function scrubRequest(req: SentryRequest): SentryRequest {
  const out: SentryRequest = { ...req };

  if (typeof out.url === "string") out.url = scrubUrl(out.url);
  // Query string estruturada ou crua — remover por completo.
  if (out.query_string !== undefined) out.query_string = "[redacted]";
  // Cookies podem carregar sessão/tokens — descartar por completo.
  if (out.cookies !== undefined) out.cookies = {};
  // Corpo da requisição pode conter respostas de questionário, e-mail, telefone.
  if (out.data !== undefined) out.data = scrubValue(out.data);

  if (out.headers && typeof out.headers === "object") {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(out.headers as Record<string, string>)) {
      const kl = k.toLowerCase();
      if (kl === "authorization" || kl === "cookie" || kl === "x-api-key") {
        headers[k] = "[redacted]";
      } else if (typeof v === "string") {
        headers[k] = scrubString(v);
      } else {
        headers[k] = v;
      }
    }
    out.headers = headers;
  }

  return out;
}

/**
 * Função principal: recebe um Event do Sentry e devolve uma cópia com PHI/PII
 * removidos. Serve tanto para beforeSend (erros) quanto para
 * beforeSendTransaction (traces).
 */
export function scrubSentryEvent<T extends Event>(event: T): T {
  // 1. Dados do usuário — nunca enviar identificadores diretos.
  if (event.user) {
    const { id } = event.user;
    // Mantemos apenas um id opaco se não for e-mail; o resto é descartado.
    event.user = {
      id: typeof id === "string" && !id.includes("@") ? scrubString(id) : undefined,
    };
  }

  // 2. Mensagem do evento (texto livre).
  if (typeof event.message === "string") {
    event.message = scrubString(event.message);
  }

  // 3. Exceções: valores de mensagem de erro podem conter PHI (ex.: "user joao@x.com not found").
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (typeof ex.value === "string") ex.value = scrubString(ex.value);
    }
  }

  // 4. Request (url, query, body, cookies, headers).
  if (event.request) {
    event.request = scrubRequest(event.request);
  }

  // 5. Contexto extra, tags e contexts (podem ter clinic_id/phone via logger.setExtras).
  if (event.extra) event.extra = scrubValue(event.extra) as Event["extra"];
  if (event.tags) event.tags = scrubValue(event.tags) as Event["tags"];
  if (event.contexts) event.contexts = scrubValue(event.contexts) as Event["contexts"];

  // 6. Breadcrumbs (timeline de logs — o logger.ts injeta data com contexto).
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((bc: Breadcrumb) => {
      const next: Breadcrumb = { ...bc };
      if (typeof next.message === "string") next.message = scrubString(next.message);
      if (next.data) next.data = scrubValue(next.data) as Breadcrumb["data"];
      return next;
    });
  }

  return event;
}
