"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { saveWhatsAppBotConfig } from "./actions";
import type { PricingLocation, PricingPlan } from "@/lib/whatsapp-bot-defaults";
import { IFWC_DEFAULT_CONFIG } from "@/lib/whatsapp-bot-defaults";
import type { WhatsAppBotConfig } from "@/services/whatsapp-bot-service";

const LANGUAGE_OPTIONS = [
  { value: "pt-BR", labelKey: "langPtBr" },
  { value: "pt-PT", labelKey: "langPtPt" },
  { value: "en-US", labelKey: "langEnUs" },
];

// SEC-07: use env var so URLs stay correct if domain changes
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://axiel-core-6ikl.vercel.app";
const TWILIO_WEBHOOK_URL = `${APP_URL}/api/whatsapp/webhook`;
const META_WEBHOOK_URL = `${APP_URL}/api/meta/whatsapp`;

export function WhatsAppBotForm({ initialConfig }: { initialConfig?: WhatsAppBotConfig | null }) {
  const t = useTranslations("settings.whatsapp");
  const cfg = initialConfig ?? null;
  const defaults = IFWC_DEFAULT_CONFIG;

  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [locations, setLocations] = useState<PricingLocation[]>(cfg?.locations ?? defaults.locations);

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

  // UX-01: handle save errors explicitly so the user sees a message instead of a silent hang
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("locations_json", JSON.stringify(locations));
    setSaveError(null);
    startTransition(async () => {
      try {
        await saveWhatsAppBotConfig(formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : t("errSave"));
      }
    });
  }

  const hasConfig = !!cfg;
  const hasTwilioNumber = !!(cfg?.twilio_number);
  const hasMetaPhoneId = !!(cfg?.meta_phone_number_id);
  const isActive = !!cfg?.is_active;

  return (
    <div className="flex flex-col gap-6">
      {/* Activation checklist */}
      <Card className="p-6">
        <h2 className="mb-1 text-base font-semibold">{t("checklistTitle")}</h2>
        <p className="mb-5 text-sm text-black/50">{t("checklistDesc")}</p>
        <ol className="flex flex-col gap-4">
          <li className="flex items-start gap-3">
            {hasConfig ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-black/20" />
            )}
            <div>
              <p className="text-sm font-medium">{t("step1Title")}</p>
              <p className="text-xs text-black/45">{t("step1Desc")}</p>
            </div>
          </li>

          {/* ── Twilio (canal legado) ── */}
          <li className="flex items-start gap-3">
            {hasTwilioNumber ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-black/20" />
            )}
            <div>
              <p className="text-sm font-medium">{t("step2aTitle")}</p>
              <p className="mb-2 text-xs text-black/45">{t.rich("step2aDesc", { b: (c) => <strong>{c}</strong> })}</p>
              <div className="rounded-lg bg-black/[.04] p-3 font-mono text-xs leading-6 text-black/70">
                <div><span className="text-axiel-ink font-semibold">TWILIO_ACCOUNT_SID</span>=ACxxx…</div>
                <div><span className="text-axiel-ink font-semibold">TWILIO_AUTH_TOKEN</span>=xxx…</div>
                <div><span className="text-axiel-ink font-semibold">TWILIO_FROM_NUMBER</span>=whatsapp:+14155238886</div>
              </div>
              <p className="mt-2 text-xs text-black/45 mb-2">{t("twilioWebhookLabel")}</p>
              <div className="flex items-center gap-2 rounded-lg bg-black/[.04] px-3 py-2 font-mono text-xs text-black/70">
                <span className="flex-1 break-all">{TWILIO_WEBHOOK_URL}</span>
                <button type="button" onClick={() => navigator.clipboard.writeText(TWILIO_WEBHOOK_URL)}
                  className="shrink-0 rounded bg-axiel-ink/10 px-2 py-1 text-[10px] font-semibold text-axiel-ink hover:bg-axiel-ink/20 transition">
                  {t("copy")}
                </button>
              </div>
            </div>
          </li>

          {/* ── Meta API (canal principal) ── */}
          <li className="flex items-start gap-3">
            {hasMetaPhoneId ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-black/20" />
            )}
            <div>
              <p className="text-sm font-medium">{t("step2bTitle")}</p>
              <p className="mb-2 text-xs text-black/45">{t.rich("step2bDesc", { b: (c) => <strong>{c}</strong> })}</p>
              <div className="rounded-lg bg-black/[.04] p-3 font-mono text-xs leading-6 text-black/70">
                <div><span className="text-axiel-ink font-semibold">META_WHATSAPP_TOKEN</span>=EAAxxxxx…</div>
                <div><span className="text-axiel-ink font-semibold">META_PHONE_NUMBER_ID</span>=1031933676681061</div>
                <div><span className="text-axiel-ink font-semibold">META_APP_SECRET</span>=xxxxxxxx</div>
                <div><span className="text-axiel-ink font-semibold">META_VERIFY_TOKEN</span>=seu_token_verificação</div>
              </div>
              <p className="mt-2 text-xs text-black/45 mb-2">{t.rich("metaWebhookLabel", { b: (c) => <strong>{c}</strong> })}</p>
              <div className="flex items-center gap-2 rounded-lg bg-black/[.04] px-3 py-2 font-mono text-xs text-black/70">
                <span className="flex-1 break-all">{META_WEBHOOK_URL}</span>
                <button type="button" onClick={() => navigator.clipboard.writeText(META_WEBHOOK_URL)}
                  className="shrink-0 rounded bg-axiel-ink/10 px-2 py-1 text-[10px] font-semibold text-axiel-ink hover:bg-axiel-ink/20 transition">
                  {t("copy")}
                </button>
              </div>
              <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-axiel-ink hover:underline">
                {t("openMeta")} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </li>
        </ol>
        {isActive && (
          <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {t("botActive")}
          </div>
        )}
      </Card>

    <form onSubmit={handleSubmit} className="contents">
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">{t("identityTitle")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">{t("professionalName")}</label>
            <input name="professional_name" defaultValue={cfg?.professional_name ?? defaults.professional_name}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("clinicName")}</label>
            <input name="clinic_name" defaultValue={cfg?.clinic_name ?? defaults.clinic_name}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("specialty")}</label>
            <input name="specialty" defaultValue={cfg?.specialty ?? defaults.specialty}
              placeholder={t("specialtyPlaceholder")}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t("language")}</label>
            <select name="language" defaultValue={cfg?.language ?? defaults.language}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20">
              {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("twilioNumber")}</label>
            <input name="twilio_number" defaultValue={cfg?.twilio_number ?? ""} placeholder="+14155238886"
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
            <p className="mt-1 text-xs text-black/40">{t("twilioNumberHint")}</p>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">{t("metaPhoneId")}</label>
            <input name="meta_phone_number_id" defaultValue={cfg?.meta_phone_number_id ?? ""} placeholder="ex: 1031933676681061"
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
            <p className="mt-1 text-xs text-black/40">{t("metaPhoneIdHint")}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("programTitle")}</h2>
        <p className="mb-4 text-sm text-black/50">{t("programDesc")}</p>
        <textarea name="methodology" rows={8} defaultValue={cfg?.methodology ?? defaults.methodology}
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("pricingTitle")}</h2>
            <p className="mt-1 text-sm text-black/50">{t("pricingDesc")}</p>
          </div>
          <Button type="button" onClick={addLocation}>{t("addCity")}</Button>
        </div>

        <div className="flex flex-col gap-6">
          {locations.map((loc, locIdx) => (
            <div key={locIdx} className="rounded-lg border border-black/10 p-4">
              <div className="mb-3 flex items-center gap-3">
                <input value={loc.city} onChange={(e) => updateLocationCity(locIdx, e.target.value)}
                  placeholder={t("cityPlaceholder")}
                  className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
                <button type="button" onClick={() => removeLocation(locIdx)}
                  className="text-sm text-red-500 hover:text-red-700">{t("remove")}</button>
              </div>
              <div className="flex flex-col gap-2">
                {loc.plans.map((plan, planIdx) => (
                  <div key={planIdx} className="grid grid-cols-12 gap-2 rounded bg-black/[0.03] p-2">
                    <input value={plan.name} onChange={(e) => updatePlan(locIdx, planIdx, "name", e.target.value)}
                      placeholder={t("planName")}
                      className="col-span-4 rounded border border-black/15 px-2 py-1.5 text-sm focus:outline-none" />
                    <input value={plan.price} onChange={(e) => updatePlan(locIdx, planIdx, "price", e.target.value)}
                      placeholder={t("planPrice")}
                      className="col-span-2 rounded border border-black/15 px-2 py-1.5 text-sm focus:outline-none" />
                    <input value={plan.description} onChange={(e) => updatePlan(locIdx, planIdx, "description", e.target.value)}
                      placeholder={t("planDesc")}
                      className="col-span-4 rounded border border-black/15 px-2 py-1.5 text-sm focus:outline-none" />
                    <label className="col-span-1 flex items-center gap-1 text-xs text-black/50">
                      <input type="checkbox" checked={plan.recommended ?? false}
                        onChange={(e) => updatePlan(locIdx, planIdx, "recommended", e.target.checked)} />
                      {t("planRec")}
                    </label>
                    <button type="button" onClick={() => removePlan(locIdx, planIdx)}
                      className="col-span-1 text-xs text-red-400 hover:text-red-600">✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => addPlan(locIdx)}
                  className="mt-1 text-left text-sm text-axiel-ink/60 hover:text-axiel-ink">{t("addPlan")}</button>
              </div>
            </div>
          ))}
          {locations.length === 0 && (
            <p className="text-sm text-black/40">{t("noCities")}</p>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">{t("extraTitle")}</h2>
        <p className="mb-4 text-sm text-black/50">{t("extraDesc")}</p>
        <textarea name="custom_instructions" rows={4}
          defaultValue={cfg?.custom_instructions ?? ""}
          placeholder={t("extraPlaceholder")}
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-axiel-ink/20" />
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? t("saving") : t("save")}
        </Button>
        {saved && <span className="text-sm text-green-600">{t("savedMsg")}</span>}
        {saveError && <span className="text-sm text-red-600">✗ {saveError}</span>}
      </div>
    </form>
    </div>
  );
}
