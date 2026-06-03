import { NextRequest, NextResponse } from "next/server";
import { checkRateLimitDb } from "@/lib/webhook-guard";
import {
  resolveClinicByKey,
  upsertGrowthLead,
  type GrowthLeadPayload,
} from "@/services/growth-integration-service";

export const runtime = "nodejs";

// =============================================================================
// POST /api/integrations/growth/lead
// Recebe um lead "quente" do AXIEL Growth e cria/atualiza o lead no Core.
// Auth: Authorization: Bearer <INTEGRATION_KEY>  (chave gerada em Settings).
// Idempotência: header Idempotency-Key OU body.growth_lead_id.
// =============================================================================

function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function POST(req: NextRequest) {
  // 1) Auth
  const rawKey = bearer(req);
  if (!rawKey) {
    return NextResponse.json({ ok: false, error: "missing_authorization" }, { status: 401 });
  }

  // 2) Rate limit por prefixo da chave (não loga a chave inteira)
  const rlKey = `growth_lead:${rawKey.slice(0, 12)}`;
  if (!(await checkRateLimitDb(rlKey, 120, 60_000))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  // 3) Resolve a clínica pela chave (sem fallback — chave inválida = 401)
  const resolved = await resolveClinicByKey(rawKey).catch(() => null);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "invalid_key" }, { status: 401 });
  }

  // 4) Corpo
  let payload: GrowthLeadPayload;
  try {
    payload = (await req.json()) as GrowthLeadPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // Idempotency-Key tem prioridade sobre body.growth_lead_id
  const idemKey = req.headers.get("idempotency-key");
  if (idemKey && !payload.growth_lead_id) payload.growth_lead_id = idemKey;

  // Validação mínima: precisa de pelo menos um identificador de contato
  if (!payload.name && !payload.phone && !payload.email) {
    return NextResponse.json({ ok: false, error: "missing_contact" }, { status: 422 });
  }

  // 5) Upsert idempotente
  try {
    const { leadId, created } = await upsertGrowthLead(resolved.clinicId, payload);
    return NextResponse.json({
      ok: true,
      clinic_id: resolved.clinicId,
      lead_id: leadId,
      created,
    });
  } catch (err) {
    console.error("Growth lead intake error:", err);
    return NextResponse.json({ ok: false, error: "intake_failed" }, { status: 500 });
  }
}
