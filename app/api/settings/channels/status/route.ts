import { NextResponse } from "next/server";
import { getCurrentClinic } from "@/services/clinic-service";
import { getWhatsAppBotConfig } from "@/services/whatsapp-bot-service";
import { getFacebookPageStatus, getInstagramStatus } from "@/lib/meta-channel-status";

// Status ao vivo dos canais Meta da clínica logada. Chamado pelo cliente DEPOIS
// que a página já renderizou (ver app/settings/channels/channels-panel.tsx), para
// que a Graph API nunca segure o render RSC e estoure o maxDuration da função.
// O token vive só aqui/na lib e NUNCA é retornado — devolvemos apenas o que a UI
// mostra (nome/@handle, estado, assinatura do webhook).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const clinic = await getCurrentClinic();
  if (!clinic) {
    return NextResponse.json({ fb: null, ig: null }, { status: 401 });
  }

  const config = await getWhatsAppBotConfig(clinic.id);
  const fbPageId = config?.meta_facebook_page_id ?? null;
  const igId = config?.meta_instagram_id ?? null;

  const [fb, ig] = await Promise.all([
    fbPageId ? getFacebookPageStatus(fbPageId) : Promise.resolve(null),
    igId ? getInstagramStatus(igId) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    fb: fb ? { name: fb.name, state: fb.state, subscribedMessages: fb.subscribedMessages } : null,
    ig: ig ? { username: ig.username, state: ig.state, subscribedMessages: ig.subscribedMessages } : null,
  });
}
