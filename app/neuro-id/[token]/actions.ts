"use server";

import { headers } from "next/headers";
import {
  submitUnifiedFormViaToken,
  type UnifiedPublicContact,
} from "@/services/unified-form-link-service";

/**
 * Submit PÚBLICO (sem sessão) do formulário unificado Neuro ID via link.
 * Roteia por dentro do serviço: convite de paciente → grava o Bio³; link público
 * → cria/atualiza lead. Não expõe o grau de disfunção ao respondente.
 */
export async function submitUnifiedFormPublicAction(
  token: string,
  answers: Record<string, number | string | string[]>,
  contact?: UnifiedPublicContact,
): Promise<{ ok: boolean; error?: string; crisis?: boolean }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
  const userAgent = h.get("user-agent");

  const res = await submitUnifiedFormViaToken(token, answers, { ip, userAgent, contact });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, crisis: res.safety.crisis };
}
