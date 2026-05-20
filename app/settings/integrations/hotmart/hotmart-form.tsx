"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { saveHotmartConfigAction } from "./actions";

interface Props {
  clinicId: string;
  webhookUrl: string;
  hasToken: boolean;
}

export function HotmartForm({ clinicId: _clinicId, webhookUrl, hasToken }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveHotmartConfigAction(formData);
      if (result.error) { setError(result.error); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Instruções */}
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Como configurar</h2>
        <ol className="mt-3 space-y-3 text-sm text-black/65">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] text-[10px] font-semibold text-white">1</span>
            No painel da Hotmart, vá em <strong>Ferramentas → Webhooks</strong>.
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] text-[10px] font-semibold text-white">2</span>
            Clique em <strong>Adicionar novo webhook</strong> e cole a URL abaixo.
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] text-[10px] font-semibold text-white">3</span>
            Copie o <strong>hottok</strong> gerado pela Hotmart e cole no campo abaixo.
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A] text-[10px] font-semibold text-white">4</span>
            Selecione os eventos: <strong>PURCHASE_COMPLETE</strong>, <strong>PURCHASE_CANCELLED</strong>, <strong>PURCHASE_REFUNDED</strong>.
          </li>
        </ol>
      </Card>

      {/* URL do webhook */}
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">URL do Webhook</h2>
        <p className="mb-3 text-sm text-black/50">Cole este endereço no painel da Hotmart.</p>
        <div className="flex items-center gap-2 rounded-lg border border-black/15 bg-[#F4F3EF] px-3 py-2">
          <code className="flex-1 truncate text-xs text-[#0F1A2E]">{webhookUrl}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-md bg-[#0B1F3A] px-3 py-1.5 text-xs font-medium text-white hover:bg-black transition"
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </Card>

      {/* Hottok */}
      <form onSubmit={handleSubmit}>
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-semibold">Token de autenticação (hottok)</h2>
          <p className="mb-4 text-sm text-black/50">
            Encontrado no painel da Hotmart ao criar o webhook. Garante que apenas a Hotmart pode disparar este endpoint.
          </p>
          {hasToken && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#0F6E56]/20 bg-[#E1F5EE] px-3 py-2 text-sm text-[#0F6E56]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Token configurado. Cole um novo para substituir.
            </div>
          )}
          <input
            name="hottok"
            type="text"
            placeholder="Cole o hottok gerado pela Hotmart"
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-axiel-ink/20"
          />
          <div className="mt-4 flex items-center gap-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar token"}
            </Button>
            {saved && <span className="text-sm text-green-600">Token salvo com sucesso.</span>}
            {error && <span className="text-sm text-red-500">{error}</span>}
          </div>
        </Card>
      </form>
    </div>
  );
}
