import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { redirect } from "next/navigation";
import { getCurrentClinic } from "@/services/clinic-service";
import { getNfseConfig } from "@/services/nfse-service";
import { NfseConfigForm } from "./nfse-config-form";

export default async function NfseSettingsPage() {
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const config = await getNfseConfig(clinic.id);

  return (
    <Shell>
      <div className="mb-7">
        <Link
          href="/settings/integrations"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integrações
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">Integrações</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">NFS-e · NFe.io</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px] max-w-xl">
          Configure sua conta NFe.io para emitir notas fiscais de serviço diretamente pelo AXIEL.
        </p>
      </div>

      <div className="space-y-5">
        {/* Status */}
        <div className="flex items-center gap-3 rounded-xl border border-black/[.07] bg-white px-5 py-4">
          <div className={`h-2 w-2 rounded-full ${config ? "bg-[#0F6E56]" : "bg-[#D3D1C7]"}`} />
          <p className="text-[13px] font-medium text-[#0F1A2E]">
            {config ? "NFe.io configurado" : "Não configurado"}
          </p>
          {config && (
            <Link
              href="/financeiro/nfse"
              className="ml-auto text-[12px] font-medium text-[#0F6E56] hover:underline"
            >
              Ver notas emitidas →
            </Link>
          )}
        </div>

        {/* Config form */}
        <div className="rounded-2xl border border-black/[.07] bg-white p-6">
          <p className="text-[13px] font-semibold text-[#0F1A2E] mb-1">Configuração da API</p>
          <p className="text-[11px] text-[#A09E98] mb-5">
            Os dados são armazenados de forma segura e usados apenas para emitir notas em seu nome.
          </p>
          <NfseConfigForm config={config} />
        </div>

        {/* How it works */}
        <div className="rounded-xl border border-black/[.07] bg-[#FAFAF8] p-5">
          <p className="text-[12px] font-semibold text-[#0F1A2E] mb-3">Como funciona</p>
          <ol className="space-y-2 text-[12px] text-[#6B6A66]">
            <li className="flex gap-2"><span className="font-semibold text-[#0F1A2E] shrink-0">1.</span>Crie uma conta em <a href="https://app.nfe.io" target="_blank" rel="noopener noreferrer" className="text-[#0F6E56] hover:underline">app.nfe.io</a> e cadastre sua empresa</li>
            <li className="flex gap-2"><span className="font-semibold text-[#0F1A2E] shrink-0">2.</span>Copie sua API Key e Company ID e cole nos campos acima</li>
            <li className="flex gap-2"><span className="font-semibold text-[#0F1A2E] shrink-0">3.</span>Acesse <strong>Financeiro → NFS-e</strong> e emita notas por pagamento ou manualmente</li>
            <li className="flex gap-2"><span className="font-semibold text-[#0F1A2E] shrink-0">4.</span>O PDF fica disponível para download assim que a prefeitura processar</li>
          </ol>
        </div>
      </div>
    </Shell>
  );
}
