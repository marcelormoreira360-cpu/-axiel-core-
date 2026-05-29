/**
 * /api/p/push — patient portal Web Push subscribe / unsubscribe
 *
 * POST { action: "subscribe", token, endpoint, keys: { p256dh, auth }, userAgent? }
 * POST { action: "unsubscribe", token, endpoint }
 *
 * Authentication: portal token (hashed → patient_portal_links lookup).
 * No Supabase Auth session required — patients are not Auth users.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function validateToken(token: string) {
  const supabase = createSupabaseAdminClient();
  const { data: link } = await supabase
    .from("patient_portal_links")
    .select("id, clinic_id, patient_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) return null;
  return link as { id: string; clinic_id: string; patient_id: string };
}

export async function POST(req: NextRequest) {
  let body: {
    action?: string;
    token?: string;
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const { action, token, endpoint } = body;

  if (!token) return NextResponse.json({ error: "Token ausente." }, { status: 400 });
  if (!action) return NextResponse.json({ error: "action ausente." }, { status: 400 });

  const link = await validateToken(token);
  if (!link) return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  // ── Subscribe ──────────────────────────────────────────────────────────────
  if (action === "subscribe") {
    const { keys, userAgent } = body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Dados de subscription inválidos." }, { status: 422 });
    }

    const { error } = await supabase
      .from("patient_push_subscriptions")
      .upsert(
        {
          patient_id: link.patient_id,
          clinic_id:  link.clinic_id,
          endpoint,
          p256dh:     keys.p256dh,
          auth:       keys.auth,
          user_agent: userAgent ?? null,
        },
        { onConflict: "patient_id,endpoint" },
      );

    if (error) return NextResponse.json({ error: "Erro ao salvar subscription." }, { status: 500 });

    return NextResponse.json({ ok: true });
  }

  // ── Unsubscribe ────────────────────────────────────────────────────────────
  if (action === "unsubscribe") {
    if (!endpoint) return NextResponse.json({ error: "Endpoint obrigatório." }, { status: 422 });

    await supabase
      .from("patient_push_subscriptions")
      .delete()
      .eq("patient_id", link.patient_id)
      .eq("endpoint", endpoint);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action desconhecida." }, { status: 400 });
}
