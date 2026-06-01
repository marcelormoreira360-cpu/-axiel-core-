import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { SimplePageHeader } from "@/components/simple-page-header";
import { createPatientAction } from "./actions";

// Full international dial codes — sorted by country name
const COUNTRY_CODES = [
  { code: "+55",  flag: "🇧🇷", label: "Brasil" },
  { code: "+1",   flag: "🇺🇸", label: "EUA / Canadá" },
  { code: "+351", flag: "🇵🇹", label: "Portugal" },
  { code: "+34",  flag: "🇪🇸", label: "Espanha" },
  { code: "+49",  flag: "🇩🇪", label: "Alemanha" },
  { code: "+44",  flag: "🇬🇧", label: "Reino Unido" },
  { code: "+33",  flag: "🇫🇷", label: "França" },
  { code: "+39",  flag: "🇮🇹", label: "Itália" },
  { code: "+54",  flag: "🇦🇷", label: "Argentina" },
  { code: "+56",  flag: "🇨🇱", label: "Chile" },
  { code: "+57",  flag: "🇨🇴", label: "Colômbia" },
  { code: "+52",  flag: "🇲🇽", label: "México" },
  { code: "+51",  flag: "🇵🇪", label: "Peru" },
  { code: "+598", flag: "🇺🇾", label: "Uruguai" },
  { code: "+595", flag: "🇵🇾", label: "Paraguai" },
  { code: "+593", flag: "🇪🇨", label: "Equador" },
  { code: "+591", flag: "🇧🇴", label: "Bolívia" },
  { code: "+58",  flag: "🇻🇪", label: "Venezuela" },
  { code: "+53",  flag: "🇨🇺", label: "Cuba" },
  { code: "+506", flag: "🇨🇷", label: "Costa Rica" },
  { code: "+507", flag: "🇵🇦", label: "Panamá" },
  { code: "+504", flag: "🇭🇳", label: "Honduras" },
  { code: "+502", flag: "🇬🇹", label: "Guatemala" },
  { code: "+503", flag: "🇸🇻", label: "El Salvador" },
  { code: "+505", flag: "🇳🇮", label: "Nicarágua" },
  { code: "+509", flag: "🇭🇹", label: "Haiti" },
  { code: "+1809",flag: "🇩🇴", label: "República Dominicana" },
  { code: "+81",  flag: "🇯🇵", label: "Japão" },
  { code: "+82",  flag: "🇰🇷", label: "Coreia do Sul" },
  { code: "+86",  flag: "🇨🇳", label: "China" },
  { code: "+91",  flag: "🇮🇳", label: "Índia" },
  { code: "+61",  flag: "🇦🇺", label: "Austrália" },
  { code: "+64",  flag: "🇳🇿", label: "Nova Zelândia" },
  { code: "+27",  flag: "🇿🇦", label: "África do Sul" },
  { code: "+20",  flag: "🇪🇬", label: "Egito" },
  { code: "+234", flag: "🇳🇬", label: "Nigéria" },
  { code: "+254", flag: "🇰🇪", label: "Quênia" },
  { code: "+212", flag: "🇲🇦", label: "Marrocos" },
  { code: "+213", flag: "🇩🇿", label: "Argélia" },
  { code: "+216", flag: "🇹🇳", label: "Tunísia" },
  { code: "+966", flag: "🇸🇦", label: "Arábia Saudita" },
  { code: "+971", flag: "🇦🇪", label: "Emirados Árabes" },
  { code: "+972", flag: "🇮🇱", label: "Israel" },
  { code: "+90",  flag: "🇹🇷", label: "Turquia" },
  { code: "+7",   flag: "🇷🇺", label: "Rússia" },
  { code: "+48",  flag: "🇵🇱", label: "Polônia" },
  { code: "+31",  flag: "🇳🇱", label: "Países Baixos" },
  { code: "+32",  flag: "🇧🇪", label: "Bélgica" },
  { code: "+41",  flag: "🇨🇭", label: "Suíça" },
  { code: "+43",  flag: "🇦🇹", label: "Áustria" },
  { code: "+46",  flag: "🇸🇪", label: "Suécia" },
  { code: "+47",  flag: "🇳🇴", label: "Noruega" },
  { code: "+45",  flag: "🇩🇰", label: "Dinamarca" },
  { code: "+358", flag: "🇫🇮", label: "Finlândia" },
  { code: "+353", flag: "🇮🇪", label: "Irlanda" },
  { code: "+30",  flag: "🇬🇷", label: "Grécia" },
  { code: "+420", flag: "🇨🇿", label: "República Tcheca" },
  { code: "+36",  flag: "🇭🇺", label: "Hungria" },
  { code: "+40",  flag: "🇷🇴", label: "Romênia" },
  { code: "+380", flag: "🇺🇦", label: "Ucrânia" },
];

// World countries for address
const WORLD_COUNTRIES = [
  "Brasil", "Argentina", "Bolívia", "Chile", "Colômbia", "Equador",
  "Guiana", "Guiana Francesa", "Paraguai", "Peru", "Suriname", "Uruguai",
  "Venezuela", "Costa Rica", "Cuba", "El Salvador", "Guatemala", "Haiti",
  "Honduras", "Jamaica", "México", "Nicarágua", "Panamá", "Porto Rico",
  "República Dominicana", "Trinidad e Tobago",
  "Portugal", "Espanha", "França", "Itália", "Alemanha", "Reino Unido",
  "Países Baixos", "Bélgica", "Suíça", "Áustria", "Suécia", "Noruega",
  "Dinamarca", "Finlândia", "Irlanda", "Grécia", "Polônia", "República Tcheca",
  "Hungria", "Romênia", "Ucrânia", "Rússia", "Turquia",
  "EUA", "Canadá", "Austrália", "Nova Zelândia",
  "Japão", "China", "Coreia do Sul", "Índia", "Tailândia", "Singapura",
  "Indonésia", "Malásia", "Filipinas", "Vietnã",
  "Arábia Saudita", "Emirados Árabes Unidos", "Israel", "Egito", "Marrocos",
  "Argélia", "Tunísia", "África do Sul", "Nigéria", "Quênia", "Angola",
  "Moçambique", "Cabo Verde", "São Tomé e Príncipe",
].sort((a, b) => a.localeCompare(b, "pt"));

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  const t = await getTranslations("patients.new");
  const prefillName = name ? decodeURIComponent(name) : "";
  const [prefillFirst, ...restWords] = prefillName.trim().split(/\s+/);
  const prefillLast = restWords.join(" ");

  const inputCls =
    "min-h-[52px] rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 transition";

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
                    className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-3 text-sm outline-none focus:border-black/30 transition w-[130px] shrink-0"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code + c.label} value={c.code}>
                        {c.flag} {c.code} {c.label}
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
                <select name="country" defaultValue="Brasil" className={inputCls}>
                  {WORLD_COUNTRIES.map((c) => (
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
              className="rounded-xl border border-axiel-line bg-white p-4 text-base outline-none focus:border-black/30 transition resize-none"
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
              className="inline-flex min-h-[52px] items-center rounded-lg border border-axiel-line bg-white px-7 text-base font-semibold hover:bg-gray-50 transition"
            >
              {t("cancel")}
            </Link>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
