import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { SimplePageHeader } from "@/components/simple-page-header";
import { createPatientAction } from "./actions";

// Full international dial codes — names resolved per-locale via Intl.DisplayNames
const COUNTRY_CODES = [
  { code: "+55",  flag: "🇧🇷", regions: ["BR"] },
  { code: "+1",   flag: "🇺🇸", regions: ["US", "CA"] },
  { code: "+351", flag: "🇵🇹", regions: ["PT"] },
  { code: "+34",  flag: "🇪🇸", regions: ["ES"] },
  { code: "+49",  flag: "🇩🇪", regions: ["DE"] },
  { code: "+44",  flag: "🇬🇧", regions: ["GB"] },
  { code: "+33",  flag: "🇫🇷", regions: ["FR"] },
  { code: "+39",  flag: "🇮🇹", regions: ["IT"] },
  { code: "+54",  flag: "🇦🇷", regions: ["AR"] },
  { code: "+56",  flag: "🇨🇱", regions: ["CL"] },
  { code: "+57",  flag: "🇨🇴", regions: ["CO"] },
  { code: "+52",  flag: "🇲🇽", regions: ["MX"] },
  { code: "+51",  flag: "🇵🇪", regions: ["PE"] },
  { code: "+598", flag: "🇺🇾", regions: ["UY"] },
  { code: "+595", flag: "🇵🇾", regions: ["PY"] },
  { code: "+593", flag: "🇪🇨", regions: ["EC"] },
  { code: "+591", flag: "🇧🇴", regions: ["BO"] },
  { code: "+58",  flag: "🇻🇪", regions: ["VE"] },
  { code: "+53",  flag: "🇨🇺", regions: ["CU"] },
  { code: "+506", flag: "🇨🇷", regions: ["CR"] },
  { code: "+507", flag: "🇵🇦", regions: ["PA"] },
  { code: "+504", flag: "🇭🇳", regions: ["HN"] },
  { code: "+502", flag: "🇬🇹", regions: ["GT"] },
  { code: "+503", flag: "🇸🇻", regions: ["SV"] },
  { code: "+505", flag: "🇳🇮", regions: ["NI"] },
  { code: "+509", flag: "🇭🇹", regions: ["HT"] },
  { code: "+1809",flag: "🇩🇴", regions: ["DO"] },
  { code: "+81",  flag: "🇯🇵", regions: ["JP"] },
  { code: "+82",  flag: "🇰🇷", regions: ["KR"] },
  { code: "+86",  flag: "🇨🇳", regions: ["CN"] },
  { code: "+91",  flag: "🇮🇳", regions: ["IN"] },
  { code: "+61",  flag: "🇦🇺", regions: ["AU"] },
  { code: "+64",  flag: "🇳🇿", regions: ["NZ"] },
  { code: "+27",  flag: "🇿🇦", regions: ["ZA"] },
  { code: "+20",  flag: "🇪🇬", regions: ["EG"] },
  { code: "+234", flag: "🇳🇬", regions: ["NG"] },
  { code: "+254", flag: "🇰🇪", regions: ["KE"] },
  { code: "+212", flag: "🇲🇦", regions: ["MA"] },
  { code: "+213", flag: "🇩🇿", regions: ["DZ"] },
  { code: "+216", flag: "🇹🇳", regions: ["TN"] },
  { code: "+966", flag: "🇸🇦", regions: ["SA"] },
  { code: "+971", flag: "🇦🇪", regions: ["AE"] },
  { code: "+972", flag: "🇮🇱", regions: ["IL"] },
  { code: "+90",  flag: "🇹🇷", regions: ["TR"] },
  { code: "+7",   flag: "🇷🇺", regions: ["RU"] },
  { code: "+48",  flag: "🇵🇱", regions: ["PL"] },
  { code: "+31",  flag: "🇳🇱", regions: ["NL"] },
  { code: "+32",  flag: "🇧🇪", regions: ["BE"] },
  { code: "+41",  flag: "🇨🇭", regions: ["CH"] },
  { code: "+43",  flag: "🇦🇹", regions: ["AT"] },
  { code: "+46",  flag: "🇸🇪", regions: ["SE"] },
  { code: "+47",  flag: "🇳🇴", regions: ["NO"] },
  { code: "+45",  flag: "🇩🇰", regions: ["DK"] },
  { code: "+358", flag: "🇫🇮", regions: ["FI"] },
  { code: "+353", flag: "🇮🇪", regions: ["IE"] },
  { code: "+30",  flag: "🇬🇷", regions: ["GR"] },
  { code: "+420", flag: "🇨🇿", regions: ["CZ"] },
  { code: "+36",  flag: "🇭🇺", regions: ["HU"] },
  { code: "+40",  flag: "🇷🇴", regions: ["RO"] },
  { code: "+380", flag: "🇺🇦", regions: ["UA"] },
];

// World countries for address — ISO 3166-1 alpha-2, names resolved per-locale
const WORLD_COUNTRY_CODES = [
  "BR", "AR", "BO", "CL", "CO", "EC",
  "GY", "GF", "PY", "PE", "SR", "UY",
  "VE", "CR", "CU", "SV", "GT", "HT",
  "HN", "JM", "MX", "NI", "PA", "PR",
  "DO", "TT",
  "PT", "ES", "FR", "IT", "DE", "GB",
  "NL", "BE", "CH", "AT", "SE", "NO",
  "DK", "FI", "IE", "GR", "PL", "CZ",
  "HU", "RO", "UA", "RU", "TR",
  "US", "CA", "AU", "NZ",
  "JP", "CN", "KR", "IN", "TH", "SG",
  "ID", "MY", "PH", "VN",
  "SA", "AE", "IL", "EG", "MA",
  "DZ", "TN", "ZA", "NG", "KE", "AO",
  "MZ", "CV", "ST",
];

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  const t = await getTranslations("patients.new");
  const locale = await getLocale();
  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  const countryName = (iso: string) => regionNames.of(iso) ?? iso;
  const worldCountries = WORLD_COUNTRY_CODES
    .map((iso) => countryName(iso))
    .sort((a, b) => a.localeCompare(b, locale));
  const defaultCountry = countryName("BR");
  const prefillName = name ? decodeURIComponent(name) : "";
  const [prefillFirst, ...restWords] = prefillName.trim().split(/\s+/);
  const prefillLast = restWords.join(" ");

  const inputCls =
    "min-h-[52px] rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 dark:focus:border-white/30 transition";

  return (
    <Shell>
      <SimplePageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        helper={t("helper")}
      />
      <Card className="max-w-2xl p-6">
        <form action={createPatientAction} className="grid gap-7">

          {/* ── Nome ── */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-black/35 mb-3">{t("sectionName")}</p>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                {t("firstName")}
                <input name="first_name" required defaultValue={prefillFirst} className={inputCls} placeholder={t("firstNamePlaceholder")} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                {t("lastName")}
                <input name="last_name" defaultValue={prefillLast} className={inputCls} placeholder={t("lastNamePlaceholder")} />
              </label>
            </div>
          </section>

          {/* ── Contato ── */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-black/35 mb-3">{t("sectionContact")}</p>
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-semibold">
                {t("email")}
                <input name="email" type="email" className={inputCls} placeholder={t("emailPlaceholder")} />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                {t("phone")}
                <div className="flex gap-2">
                  <select
                    name="country_code"
                    defaultValue="+55"
                    className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-3 text-sm outline-none focus:border-black/30 dark:focus:border-white/30 transition w-[130px] shrink-0"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code + c.regions.join("-")} value={c.code}>
                        {c.flag} {c.code} {c.regions.map(countryName).join(" / ")}
                      </option>
                    ))}
                  </select>
                  <input
                    name="phone"
                    type="tel"
                    className={`${inputCls} flex-1`}
                    placeholder={t("phonePlaceholder")}
                  />
                </div>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                {t("cpf")}
                <input name="cpf" className={inputCls} placeholder={t("cpfPlaceholder")} />
              </label>
            </div>
          </section>

          {/* ── Endereço ── */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-black/35 mb-1">
              {t("sectionAddress")} <span className="normal-case font-normal">{t("optional")}</span>
            </p>
            <div className="grid gap-4 mt-3">
              <label className="grid gap-2 text-sm font-semibold">
                {t("addressLine")}
                <input name="address_line" className={inputCls} placeholder={t("addressLinePlaceholder")} />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-semibold">
                  {t("zip")}
                  <input name="zip_code" className={inputCls} placeholder={t("zipPlaceholder")} />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  {t("city")}
                  <input name="city" className={inputCls} placeholder={t("cityPlaceholder")} />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  {t("state")}
                  <input name="state" className={inputCls} placeholder={t("statePlaceholder")} />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-semibold">
                {t("country")}
                <select name="country" defaultValue={defaultCountry} className={inputCls}>
                  {worldCountries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* ── Observação ── */}
          <label className="grid gap-2 text-sm font-semibold">
            {t("notes")}
            <textarea
              name="notes"
              rows={3}
              className="rounded-xl border border-axiel-line bg-white p-4 text-base outline-none focus:border-black/30 dark:focus:border-white/30 transition resize-none"
              placeholder={t("notesPlaceholder")}
            />
          </label>

          {/* ── Ações ── */}
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="submit"
              className="min-h-[52px] rounded-lg bg-axiel-blue px-7 text-base font-semibold text-white shadow-md hover:opacity-90 transition"
            >
              {t("save")}
            </button>
            <Link
              href="/patients"
              className="inline-flex min-h-[52px] items-center rounded-lg border border-axiel-line bg-white px-7 text-base font-semibold hover:bg-gray-50 dark:hover:bg-white/[.06] transition"
            >
              {t("cancel")}
            </Link>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
