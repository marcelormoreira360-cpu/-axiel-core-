import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getCurrentUserProfile } from "@/services/user-service";
import { getBroadcastCount, sendBroadcast } from "@/services/broadcast-service";
import type { BroadcastSegment } from "@/services/broadcast-service";
import { getBillingContext } from "@/services/billing-service";
import { canUseFeature } from "@/modules/billing/feature-access";
import { getCurrentClinic } from "@/services/clinic-service";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Pro max; broadcasts to large lists need more time

const VALID_SEGMENTS: BroadcastSegment[] = ["all_active", "inactive_30", "inactive_60", "custom"];

// GET /api/automacoes/broadcast?segment=inactive_30
// Returns recipient count for a given segment (used for preview)
export async function GET(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const segment = (req.nextUrl.searchParams.get("segment") ?? "all_active") as BroadcastSegment;
  if (!VALID_SEGMENTS.includes(segment)) {
    return NextResponse.json({ error: "Segmento inválido." }, { status: 400 });
  }

  const count = await getBroadcastCount(profile.clinic_id, segment);
  return NextResponse.json({ count });
}

// POST /api/automacoes/broadcast
// Sends the broadcast. Body: { segment, title, messageBody }
export async function POST(req: NextRequest) {
  const profile = await getCurrentUserProfile();
  if (!profile?.clinic_id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  // Only owners and managers can broadcast
  if (!["clinic_owner", "clinic_manager"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "Sem permissão para envio em massa." }, { status: 403 });
  }

  // Feature gate: whatsapp_automation (same as individual automations)
  const clinic = await getCurrentClinic();
  if (clinic) {
    const billingCtx = await getBillingContext(clinic.id);
    if (!canUseFeature(billingCtx, "whatsapp_automation")) {
      return NextResponse.json(
        { error: "Envio em massa disponível no plano Scale ou superior." },
        { status: 403 },
      );
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const { segment, title, messageBody } = body as {
    segment?: string;
    title?: string;
    messageBody?: string;
  };

  if (!segment || !VALID_SEGMENTS.includes(segment as BroadcastSegment)) {
    return NextResponse.json({ error: "Segmento inválido." }, { status: 400 });
  }
  if (!messageBody || typeof messageBody !== "string" || messageBody.trim().length < 5) {
    return NextResponse.json({ error: "Mensagem muito curta." }, { status: 400 });
  }
  if (messageBody.length > 1000) {
    return NextResponse.json({ error: "Mensagem muito longa (máx 1000 caracteres)." }, { status: 400 });
  }

  const result = await sendBroadcast({
    clinicId:    profile.clinic_id,
    userId:      profile.id,
    segment:     segment as BroadcastSegment,
    title:       (title as string | undefined)?.trim() || `Broadcast ${new Date().toLocaleDateString("pt-BR")}`,
    messageBody: messageBody.trim(),
  });

  return NextResponse.json({ ok: true, ...result });
}
