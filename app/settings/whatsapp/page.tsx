import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { WhatsAppBotForm } from "./whatsapp-bot-form";
import { getCurrentClinic } from "@/services/clinic-service";
import { getWhatsAppBotConfig } from "@/services/whatsapp-bot-service";

export default async function WhatsAppSettingsPage() {
  const clinic = await getCurrentClinic();
  const config = clinic ? await getWhatsAppBotConfig(clinic.id) : null;

  return (
    <Shell>
      <div className="mb-7">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Configurações</p>
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">WhatsApp Bot</h1>
          {config?.is_active ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Ativo</span>
          ) : (
            <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/45">Inativo</span>
          )}
        </div>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Configure o assistente de atendimento do WhatsApp para a sua clínica.
        </p>
      </div>
      <WhatsAppBotForm initialConfig={config} />
    </Shell>
  );
}
