import Link from "next/link";
import { ArrowLeft, ExternalLink, Phone } from "lucide-react";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";

const WEBHOOK_URL = "https://axiel-core-6ikl.vercel.app/api/voice/webhook";

export default function VoiceSettingsPage() {
  return (
    <Shell>
      <div className="mb-7">
        <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Configurações
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Configurações</p>
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">Ligações com IA</h1>
          <span className="rounded-full bg-axiel-gold/15 px-3 py-1 text-xs font-semibold text-axiel-gold">Pronto para ativar</span>
        </div>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">
          A IA atende ligações automaticamente, fala em português e inglês, e usa a mesma persona configurada no WhatsApp Bot.
        </p>
      </div>

      <div className="flex flex-col gap-5 max-w-2xl">
        {/* How it works */}
        <Card className="p-6">
          <h2 className="mb-1 text-base font-semibold">Como funciona</h2>
          <p className="mb-5 text-sm text-black/50">Cada ligação recebida no número Twilio é atendida pela IA usando o fluxo de vendas da sua clínica.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: "1", title: "Paciente liga", desc: "Para o número Twilio configurado" },
              { icon: "2", title: "IA atende", desc: "Saúda com a voz da Camila (Polly Neural)" },
              { icon: "3", title: "Conversa fluída", desc: "GPT-4 responde em tempo real, máx. 2 frases por vez" },
            ].map((step) => (
              <div key={step.icon} className="rounded-xl bg-axiel-soft p-4">
                <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-axiel-ink text-xs font-bold text-white">{step.icon}</div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs text-black/50">{step.desc}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Languages */}
        <Card className="p-6">
          <h2 className="mb-1 text-base font-semibold">Idiomas suportados</h2>
          <p className="mb-4 text-sm text-black/50">O idioma é definido pela configuração do WhatsApp Bot (campo "Idioma do bot").</p>
          <div className="grid gap-2 md:grid-cols-3">
            {[
              { lang: "Português (Brasil)", voice: "Polly.Camila-Neural", code: "pt-BR" },
              { lang: "Português (Portugal)", voice: "Polly.Ines-Neural", code: "pt-PT" },
              { lang: "English (US)", voice: "Polly.Joanna-Neural", code: "en-US" },
            ].map((item) => (
              <div key={item.code} className="rounded-lg border border-black/[.07] p-3">
                <p className="text-sm font-medium">{item.lang}</p>
                <p className="mt-0.5 font-mono text-xs text-black/40">{item.voice}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Activation */}
        <Card className="p-6">
          <h2 className="mb-1 text-base font-semibold">Ativar — 2 passos</h2>
          <p className="mb-5 text-sm text-black/50">Diferente do WhatsApp (sandbox), ligações precisam de um número de voz Twilio dedicado.</p>

          <ol className="flex flex-col gap-5">
            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-axiel-ink text-xs font-bold text-white mt-0.5">1</div>
              <div className="flex-1">
                <p className="text-sm font-medium">Comprar um número de voz no Twilio</p>
                <p className="mb-2 text-xs text-black/45">No Console Twilio: <strong>Phone Numbers → Manage → Buy a number</strong>. Filtre por "Voice" e escolha um número brasileiro (+55) ou americano (+1).</p>
                <a
                  href="https://console.twilio.com/us1/develop/phone-numbers/search"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-axiel-ink hover:underline"
                >
                  Comprar número <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-axiel-ink text-xs font-bold text-white mt-0.5">2</div>
              <div className="flex-1">
                <p className="text-sm font-medium">Configurar o webhook no número comprado</p>
                <p className="mb-2 text-xs text-black/45">
                  No Console: <strong>Phone Numbers → Manage → Active Numbers → clique no número → Voice &amp; Fax → "A call comes in"</strong>. Selecione <strong>Webhook</strong>, método <strong>POST</strong>, e cole a URL:
                </p>
                <VoiceWebhookCopy url={WEBHOOK_URL} />
              </div>
            </li>
          </ol>

          <div className="mt-5 rounded-xl border border-black/[.07] bg-black/[.02] p-4">
            <p className="text-xs font-semibold text-black/60">Após configurar</p>
            <p className="mt-1 text-xs text-black/45">
              Ligue para o número comprado — a IA vai atender imediatamente usando a persona e o fluxo de vendas configurados em{" "}
              <Link href="/settings/whatsapp" className="text-axiel-ink hover:underline">WhatsApp Bot</Link>.
            </p>
          </div>
        </Card>

        {/* Current config reminder */}
        <Card className="p-5 bg-axiel-soft">
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-axiel-ink/60" />
            <div>
              <p className="text-sm font-medium">Persona das ligações</p>
              <p className="mt-1 text-xs text-black/50">
                A IA nas ligações usa exatamente a mesma configuração do WhatsApp Bot (nome, especialidade, metodologia, preços). Para alterar o que ela fala, edite em{" "}
                <Link href="/settings/whatsapp" className="text-axiel-ink hover:underline">Configurações → WhatsApp Bot</Link>.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Shell>
  );
}

// Client component for copy button
function VoiceWebhookCopy({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/[.04] px-3 py-2 font-mono text-xs text-black/70">
      <span className="flex-1 break-all">{url}</span>
    </div>
  );
}
