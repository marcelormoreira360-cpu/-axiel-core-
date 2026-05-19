import { Shell } from "@/components/shell";
import { WhatsAppBotForm } from "./whatsapp-bot-form";

export default function WhatsAppSettingsPage() {
  return (
    <Shell>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Settings</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">WhatsApp Bot</h1>
        <p className="mt-3 max-w-2xl text-lg text-black/55">
          Configure o assistente de atendimento do WhatsApp para a sua clínica.
        </p>
      </div>
      <WhatsAppBotForm />
    </Shell>
  );
}
