import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { WhatsAppBotForm } from "./whatsapp-bot-form";

export default function WhatsAppSettingsPage() {
  return (
    <Shell>
      <div className="mb-7">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Configurações</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">WhatsApp Bot</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          Configure o assistente de atendimento do WhatsApp para a sua clínica.
        </p>
      </div>
      <WhatsAppBotForm />
    </Shell>
  );
}
