// Cliente HTTP do Asaas (gateway BR de Pix/Boleto).
// Config por env: ASAAS_API_KEY (obrigatória), ASAAS_BASE_URL (default sandbox),
// ASAAS_WEBHOOK_TOKEN (valida o webhook). Em produção, ASAAS_BASE_URL =
// https://api.asaas.com/v3.

const DEFAULT_BASE_URL = "https://api-sandbox.asaas.com/v3";

export function getAsaasBaseUrl(): string {
  return process.env.ASAAS_BASE_URL ?? DEFAULT_BASE_URL;
}

export function isAsaasConfigured(): boolean {
  return !!process.env.ASAAS_API_KEY;
}

type AsaasError = { errors?: Array<{ code?: string; description?: string }> };

// Chamada genérica à API do Asaas. Lança erro com a mensagem do Asaas se !ok.
export async function asaasFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada.");

  const res = await fetch(`${getAsaasBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(init?.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => null)) as (T & AsaasError) | null;
  if (!res.ok) {
    const msg = data?.errors?.[0]?.description ?? `Asaas erro ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}
