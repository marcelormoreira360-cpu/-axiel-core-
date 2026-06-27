import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getClinicSettings } from "@/services/clinic-service";
import { updateRegionalSettingsAction } from "./actions";

const TIMEZONES = [
  { value: "America/Sao_Paulo",   label: "Brasília (GMT-3)" },
  { value: "America/Manaus",      label: "Manaus (GMT-4)" },
  { value: "America/Belem",       label: "Belém (GMT-3)" },
  { value: "America/Fortaleza",   label: "Fortaleza (GMT-3)" },
  { value: "America/Recife",      label: "Recife (GMT-3)" },
  { value: "America/Bahia",       label: "Salvador (GMT-3)" },
  { value: "America/Cuiaba",      label: "Cuiabá (GMT-4)" },
  { value: "America/Porto_Velho", label: "Porto Velho (GMT-4)" },
  { value: "America/Rio_Branco",  label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha",     label: "Fernando de Noronha (GMT-2)" },
  { value: "America/New_York",    label: "Nova York (GMT-5 / -4)" },
  { value: "America/Chicago",     label: "Chicago (GMT-6 / -5)" },
  { value: "America/Denver",      label: "Denver (GMT-7 / -6)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8 / -7)" },
  { value: "America/Mexico_City", label: "Cidade do México (GMT-6 / -5)" },
  { value: "America/Buenos_Aires","label": "Buenos Aires (GMT-3)" },
  { value: "America/Santiago",    label: "Santiago (GMT-4 / -3)" },
  { value: "America/Bogota",      label: "Bogotá (GMT-5)" },
  { value: "America/Lima",        label: "Lima (GMT-5)" },
  { value: "Europe/Lisbon",       label: "Lisboa (GMT+0 / +1)" },
  { value: "Europe/London",       label: "Londres (GMT+0 / +1)" },
  { value: "Europe/Madrid",       label: "Madrid (GMT+1 / +2)" },
  { value: "Europe/Paris",        label: "Paris (GMT+1 / +2)" },
  { value: "Europe/Berlin",       label: "Berlim (GMT+1 / +2)" },
  { value: "UTC",                 label: "UTC (GMT+0)" },
];

const CURRENCIES = [
  { value: "BRL", label: "BRL — Real Brasileiro (R$)" },
  { value: "USD", label: "USD — Dólar Americano ($)" },
  { value: "EUR", label: "EUR — Euro (€)" },
  { value: "GBP", label: "GBP — Libra Esterlina (£)" },
  { value: "ARS", label: "ARS — Peso Argentino ($)" },
  { value: "CLP", label: "CLP — Peso Chileno ($)" },
  { value: "COP", label: "COP — Peso Colombiano ($)" },
  { value: "MXN", label: "MXN — Peso Mexicano ($)" },
  { value: "PYG", label: "PYG — Guaraní Paraguaio (₲)" },
  { value: "UYU", label: "UYU — Peso Uruguaio ($)" },
  { value: "PEN", label: "PEN — Sol Peruano (S/)" },
  { value: "BOB", label: "BOB — Boliviano (Bs)" },
];

export default async function RegionalSettingsPage() {
  const t = await getTranslations("settings");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("users").select("clinic_id").eq("id", user.id).maybeSingle()
    : { data: null };

  const clinicId = profile?.clinic_id as string | null;
  const settings = clinicId ? await getClinicSettings(clinicId) : { timezone: "America/Sao_Paulo", default_currency: "BRL" };

  return (
    <Shell>
      <div className="mb-7">
        <BackLink fallbackHref="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition">
          <ArrowLeft className="h-3.5 w-3.5" /> {t("common.back")}
        </BackLink>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-black/35">{t("common.eyebrow")}</p>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">{t("regional.title")}</h1>
        <p className="text-[12px] text-[#A09E98] mt-[2px]">{t("regional.subtitle")}</p>
      </div>

      <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden max-w-xl">
        <div className="px-[20px] py-[16px] border-b border-black/[.06]">
          <p className="text-[14px] font-semibold text-[#0F1A2E]">{t("regional.cardTitle")}</p>
          <p className="text-[11px] text-[#A09E98] mt-[2px]">
            {t("regional.cardDesc")}
          </p>
        </div>

        <form action={updateRegionalSettingsAction} className="px-[20px] py-[20px] space-y-[16px]">
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("regional.timezone")}</label>
            <select
              name="timezone"
              defaultValue={settings.timezone}
              className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition bg-white"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[5px] block">{t("regional.currency")}</label>
            <select
              name="default_currency"
              defaultValue={settings.default_currency}
              className="w-full px-[12px] py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition bg-white"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="pt-[4px]">
            <button
              type="submit"
              className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[20px] py-[9px] transition"
            >
              {t("regional.save")}
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
