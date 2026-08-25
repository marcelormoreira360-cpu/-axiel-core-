import "server-only";
import { unstable_cache } from "next/cache";
import { createLogger } from "@/lib/logger";

/**
 * Leitura read-only do estado de conexão dos canais Meta de UMA clínica.
 *
 * Fonte dos IDs: whatsapp_bot_configs (por clinic_id) — NÃO desta lib.
 * Esta lib só resolve, a partir de um Page/IG id JÁ pertencente à clínica
 * logada, o nome/@handle e o status real de conexão via Graph API.
 *
 * Segurança / multi-tenant:
 * - O token vem SEMPRE de env var montada a partir do id recebido
 *   (mesmo padrão de getPageToken em app/api/meta/facebook/route.ts e
 *   getInstagramToken em lib/instagram-api.ts). NUNCA iteramos process.env
 *   atrás de token, e o token NUNCA é retornado/renderizado.
 * - Sem token ou falha de rede => status honesto ("configured"/"disconnected"),
 *   nunca "connected" fixo.
 */

const log = createLogger("meta-channel-status");

const FB_GRAPH = "https://graph.facebook.com/v20.0";
const IG_GRAPH = "https://graph.instagram.com/v21.0";

// Teto por chamada à Graph API. Baixo de propósito: esta leitura roda no
// caminho de render (force-dynamic) e não pode segurar a resposta RSC. Se a
// Meta demora mais que isso, devolvemos status honesto ("configured") em vez
// de estourar o maxDuration da função e abortar a página com TimeoutError.
const GRAPH_TIMEOUT_MS = 4000;

// App Meta (OXIEL Core) — mesmo default usado no webhook do Messenger.
const META_APP_ID = process.env.META_APP_ID ?? "1468755454577652";

export type ChannelConnectionState = "connected" | "configured" | "disconnected";

export type FacebookPageStatus = {
  pageId: string;
  name: string | null;
  state: ChannelConnectionState;
  subscribedMessages: boolean;
};

export type InstagramStatus = {
  igAccountId: string;
  username: string | null;
  name: string | null;
  state: ChannelConnectionState;
  subscribedMessages: boolean;
};

// ── Token resolvers (por id; sem iterar env; nunca expostos) ──────────────────

function facebookPageToken(pageId: string): string | null {
  return process.env[`META_FACEBOOK_TOKEN_${pageId}`] ?? process.env.META_FACEBOOK_PAGE_TOKEN ?? null;
}

function instagramToken(igAccountId: string): string | null {
  return process.env[`META_INSTAGRAM_TOKEN_${igAccountId}`] ?? process.env.META_INSTAGRAM_TOKEN ?? null;
}

// ── Facebook Page ─────────────────────────────────────────────────────────────

async function fetchFacebookPageStatus(pageId: string): Promise<FacebookPageStatus> {
  const token = facebookPageToken(pageId);
  // Sem token: o id está salvo (configurado) mas não dá para verificar a conexão.
  if (!token) {
    return { pageId, name: null, state: "configured", subscribedMessages: false };
  }

  try {
    // As duas leituras (nome + assinatura do webhook) são independentes: rodam
    // em paralelo para que o pior caso do Facebook fique em ~1× GRAPH_TIMEOUT_MS,
    // não 2× sequencial (que estourava o limite da função serverless).
    const [nameRes, subRes] = await Promise.all([
      fetch(
        `${FB_GRAPH}/${encodeURIComponent(pageId)}?fields=name&access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) },
      ),
      fetch(
        `${FB_GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps?access_token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) },
      ).catch((e) => {
        log.error("facebook subscribed_apps failed", e, { pageId });
        return null;
      }),
    ]);

    if (!nameRes.ok) {
      return { pageId, name: null, state: "disconnected", subscribedMessages: false };
    }
    const nameData = (await nameRes.json()) as { name?: string };

    // Estado real da assinatura do webhook: nosso app_id inscrito com o field "messages".
    let subscribedMessages = false;
    if (subRes?.ok) {
      const subData = (await subRes.json()) as {
        data?: Array<{ id?: string; subscribed_fields?: string[] }>;
      };
      subscribedMessages = (subData.data ?? []).some(
        (app) => String(app.id) === META_APP_ID && (app.subscribed_fields ?? []).includes("messages"),
      );
    }

    return {
      pageId,
      name: nameData.name ?? null,
      state: "connected",
      subscribedMessages,
    };
  } catch (e) {
    log.error("facebook page status failed", e, { pageId });
    return { pageId, name: null, state: "configured", subscribedMessages: false };
  }
}

// ── Instagram ─────────────────────────────────────────────────────────────────

async function fetchInstagramStatus(igAccountId: string): Promise<InstagramStatus> {
  const token = instagramToken(igAccountId);
  if (!token) {
    return { igAccountId, username: null, name: null, state: "configured", subscribedMessages: false };
  }

  try {
    const res = await fetch(
      `${IG_GRAPH}/${encodeURIComponent(igAccountId)}?fields=username,name&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) },
    );
    if (!res.ok) {
      return { igAccountId, username: null, name: null, state: "disconnected", subscribedMessages: false };
    }
    const data = (await res.json()) as { username?: string; name?: string };
    // O login de Instagram não expõe subscribed_apps por conta de forma simples;
    // a assinatura de "messages" é derivada de a conta estar conectada (verificada
    // via Graph 200). Rótulo honesto na UI — não afirmamos verificação que não fizemos.
    return {
      igAccountId,
      username: data.username ?? null,
      name: data.name ?? null,
      state: "connected",
      subscribedMessages: true,
    };
  } catch (e) {
    log.error("instagram status failed", e, { igAccountId });
    return { igAccountId, username: null, name: null, state: "configured", subscribedMessages: false };
  }
}

// ── API pública (cache leve de 300s por id) ───────────────────────────────────

export function getFacebookPageStatus(pageId: string): Promise<FacebookPageStatus> {
  return unstable_cache(
    () => fetchFacebookPageStatus(pageId),
    ["meta-channel-status", "facebook", pageId],
    { revalidate: 300 },
  )();
}

export function getInstagramStatus(igAccountId: string): Promise<InstagramStatus> {
  return unstable_cache(
    () => fetchInstagramStatus(igAccountId),
    ["meta-channel-status", "instagram", igAccountId],
    { revalidate: 300 },
  )();
}
