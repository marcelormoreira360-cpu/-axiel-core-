"use client";

import { useState, useTransition } from "react";
import { saveNfseConfigAction } from "./actions";
import type { NfseConfig } from "@/services/nfse-service";

interface Props {
  config: NfseConfig | null;
}

export function NfseConfigForm({ config }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await saveNfseConfigAction(fd);
      if (r.error) { setError(r.error); return; }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(error || success) && (
        <div className={`rounded-lg px-4 py-2.5 text-[12px] ${error ? "bg-red-50 text-red-600" : "bg-[#E1F5EE] text-[#0F6E56]"}`}>
          {error ?? "Configuração salva com sucesso."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
            API Key <span className="text-red-400">*</span>
          </label>
          <input
            name="api_key"
            type="password"
            defaultValue={config?.api_key ?? ""}
            placeholder="Sua API Key do NFe.io"
            required
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#0F6E56]/40"
          />
          <p className="text-[10px] text-[#A09E98] mt-1">
            Em <a href="https://app.nfe.io/account/apikeys" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] hover:underline">app.nfe.io → API Keys</a>
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
            Company ID <span className="text-red-400">*</span>
          </label>
          <input
            name="company_id"
            type="text"
            defaultValue={config?.company_id ?? ""}
            placeholder="ID da empresa no NFe.io"
            required
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#0F6E56]/40"
          />
          <p className="text-[10px] text-[#A09E98] mt-1">
            Em <a href="https://app.nfe.io/account/companies" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] hover:underline">app.nfe.io → Empresas</a>
          </p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
            Código de serviço municipal
          </label>
          <input
            name="city_service_code"
            type="text"
            defaultValue={config?.city_service_code ?? "1.05"}
            placeholder="Ex: 1.05"
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#0F6E56]/40"
          />
          <p className="text-[10px] text-[#A09E98] mt-1">Consulte a lista da prefeitura. Saúde: geralmente 1.05</p>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
            Código CNAE (opcional)
          </label>
          <input
            name="cnae_code"
            type="text"
            defaultValue={config?.cnae_code ?? ""}
            placeholder="Ex: 8630504"
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#0F6E56]/40"
          />
          <p className="text-[10px] text-[#A09E98] mt-1">8621601 = Clínica médica · 8630504 = Fisioterapia</p>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
          Descrição padrão do serviço
        </label>
        <input
          name="service_description"
          type="text"
          defaultValue={config?.service_description ?? "Prestação de serviços de saúde"}
          placeholder="Descrição que aparece nas notas emitidas"
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:border-[#0F6E56]/40"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-[#0B1F3A] px-5 py-2 text-sm font-medium text-white hover:bg-black transition disabled:opacity-50"
      >
        {isPending ? "Salvando..." : "Salvar configuração"}
      </button>
    </form>
  );
}
