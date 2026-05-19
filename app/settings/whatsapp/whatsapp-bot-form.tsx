"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { saveWhatsAppBotConfig } from "./actions";
import type { PricingLocation, PricingPlan } from "@/lib/whatsapp-bot-defaults";
import { IFWC_DEFAULT_CONFIG } from "@/lib/whatsapp-bot-defaults";

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "pt-PT", label: "Português (Portugal)" },
  { value: "en-US", label: "English (US)" },
];

export function WhatsAppBotForm() {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [locations, setLocations] = useState<PricingLocation[]>(IFWC_DEFAULT_CONFIG.locations);

  function addLocation() {
    setLocations((prev) => [...prev, { city: "", plans: [{ name: "", price: "", description: "", recommended: false }] }]);
  }

  function removeLocation(i: number) {
    setLocations((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLocationCity(i: number, city: string) {
    setLocations((prev) => prev.map((loc, idx) => idx === i ? { ...loc, city } : loc));
  }

  function addPlan(locIdx: number) {
    setLocations((prev) => prev.map((loc, idx) =>
      idx === locIdx ? { ...loc, plans: [...loc.plans, { name: "", price: "", description: "", recommended: false }] } : loc
    ));
  }

  function removePlan(locIdx: number, planIdx: number) {
    setLocations((prev) => prev.map((loc, idx) =>
      idx === locIdx ? { ...loc, plans: loc.plans.filter((_, pi) => pi !== planIdx) } : loc
    ));
  }

  function updatePlan(locIdx: number, planIdx: number, field: keyof PricingPlan, value: string | boolean) {
    setLocations((prev) => prev.map((loc, idx) =>
      idx === locIdx ? {
        ...loc,
        plans: loc.plans.map((p, pi) => pi === planIdx ? { ...p, [field]: value } : p),
      } : loc
    ));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("locations_json", JSON.stringify(locations));
    startTransition(async () => {
      await saveWhatsAppBotConfig(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Identidade da clínica</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome do profissional</label>
            <input name="professional_name" defaultValue={IFWC_DEFAULT_CONFIG.professional_name}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nome da clínica</label>
            <input name="clinic_name" defaultValue={IFWC_DEFAULT_CONFIG.clinic_name}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Especialidade / abordagem</label>
            <input name="specialty" defaultValue={IFWC_DEFAULT_CONFIG.specialty}
              placeholder="ex: fisioterapia e pilates clínico"
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Idioma do bot</label>
            <select name="language" defaultValue={IFWC_DEFAULT_CONFIG.language}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20">
              {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Número Twilio do WhatsApp (ex: +14155238886)</label>
            <input name="twilio_number" placeholder="+14155238886"
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
            <p className="mt-1 text-xs text-black/40">Vincula este número ao bot da sua clínica. Deixe em branco para usar o padrão.</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Programa / O que está incluído</h2>
        <p className="mb-4 text-sm text-black/50">Descreva o que o paciente recebe no atendimento. O bot apresenta isso na Etapa 4.</p>
        <textarea name="methodology" rows={8} defaultValue={IFWC_DEFAULT_CONFIG.methodology}
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Investimento por localidade</h2>
            <p className="mt-1 text-sm text-black/50">Adicione as cidades onde atende e os planos disponíveis em cada uma.</p>
          </div>
          <Button type="button" onClick={addLocation}>+ Adicionar cidade</Button>
        </div>

        <div className="flex flex-col gap-6">
          {locations.map((loc, locIdx) => (
            <div key={locIdx} className="rounded-lg border border-black/10 p-4">
              <div className="mb-3 flex items-center gap-3">
                <input value={loc.city} onChange={(e) => updateLocationCity(locIdx, e.target.value)}
                  placeholder="Nome da cidade (ex: São Paulo)"
                  className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
                <button type="button" onClick={() => removeLocation(locIdx)}
                  className="text-sm text-red-500 hover:text-red-700">Remover</button>
              </div>
              <div className="flex flex-col gap-2">
                {loc.plans.map((plan, planIdx) => (
                  <div key={planIdx} className="grid grid-cols-12 gap-2 rounded bg-black/[0.03] p-2">
                    <input value={plan.name} onChange={(e) => updatePlan(locIdx, planIdx, "name", e.target.value)}
                      placeholder="Nome do plano"
                      className="col-span-4 rounded border border-black/15 px-2 py-1.5 text-sm focus:outline-none" />
                    <input value={plan.price} onChange={(e) => updatePlan(locIdx, planIdx, "price", e.target.value)}
                      placeholder="Preço (ex: R$900)"
                      className="col-span-2 rounded border border-black/15 px-2 py-1.5 text-sm focus:outline-none" />
                    <input value={plan.description} onChange={(e) => updatePlan(locIdx, planIdx, "description", e.target.value)}
                      placeholder="Descrição breve"
                      className="col-span-4 rounded border border-black/15 px-2 py-1.5 text-sm focus:outline-none" />
                    <label className="col-span-1 flex items-center gap-1 text-xs text-black/50">
                      <input type="checkbox" checked={plan.recommended ?? false}
                        onChange={(e) => updatePlan(locIdx, planIdx, "recommended", e.target.checked)} />
                      Rec.
                    </label>
                    <button type="button" onClick={() => removePlan(locIdx, planIdx)}
                      className="col-span-1 text-xs text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => addPlan(locIdx)}
                  className="mt-1 text-left text-sm text-axiel-ink/60 hover:text-axiel-ink">+ Adicionar plano</button>
              </div>
            </div>
          ))}
          {locations.length === 0 && (
            <p className="text-sm text-black/40">Nenhuma localidade adicionada. Clique em "+ Adicionar cidade" acima.</p>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Instruções adicionais (opcional)</h2>
        <p className="mb-4 text-sm text-black/50">Regras específicas da sua clínica, tom de voz personalizado ou informações extras para o bot.</p>
        <textarea name="custom_instructions" rows={4}
          placeholder="ex: Sempre mencionar que o atendimento é presencial. Não agendar aos domingos."
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar configuração"}
        </Button>
        {saved && <span className="text-sm text-green-600">Configuração salva com sucesso.</span>}
      </div>
    </form>
  );
}
