import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { SimplePageHeader } from "@/components/simple-page-header";
import { createPatientAction } from "./actions";

const COUNTRY_CODES = [
  { code: "+55",  flag: "🇧🇷", label: "Brasil (+55)" },
  { code: "+1",   flag: "🇺🇸", label: "EUA / Canadá (+1)" },
  { code: "+351", flag: "🇵🇹", label: "Portugal (+351)" },
  { code: "+34",  flag: "🇪🇸", label: "Espanha (+34)" },
  { code: "+49",  flag: "🇩🇪", label: "Alemanha (+49)" },
  { code: "+44",  flag: "🇬🇧", label: "Reino Unido (+44)" },
  { code: "+33",  flag: "🇫🇷", label: "França (+33)" },
  { code: "+39",  flag: "🇮🇹", label: "Itália (+39)" },
  { code: "+54",  flag: "🇦🇷", label: "Argentina (+54)" },
  { code: "+56",  flag: "🇨🇱", label: "Chile (+56)" },
  { code: "+57",  flag: "🇨🇴", label: "Colômbia (+57)" },
  { code: "+52",  flag: "🇲🇽", label: "México (+52)" },
  { code: "+81",  flag: "🇯🇵", label: "Japão (+81)" },
  { code: "+61",  flag: "🇦🇺", label: "Austrália (+61)" },
];

const BRAZIL_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC",
  "SP","SE","TO",
];

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  const prefillName = name ? decodeURIComponent(name) : "";
  // Split prefill into first/last if possible
  const [prefillFirst, ...restWords] = prefillName.trim().split(/\s+/);
  const prefillLast = restWords.join(" ");

  return (
    <Shell>
      <SimplePageHeader
        eyebrow="NOVO PACIENTE"
        title="Adicionar paciente"
        helper="Apenas as informações essenciais para começar. Você pode adicionar mais depois."
      />
      <Card className="max-w-2xl p-6">
        <form action={createPatientAction} className="grid gap-6">

          {/* ── Nome ── */}
          <fieldset className="grid gap-4">
            <legend className="text-[11px] font-semibold uppercase tracking-[.08em] text-black/40 mb-1">Nome</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Nome
                <input
                  name="first_name"
                  required
                  defaultValue={prefillFirst}
                  className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 transition"
                  placeholder="Ex: Maria"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Sobrenome
                <input
                  name="last_name"
                  defaultValue={prefillLast}
                  className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 transition"
                  placeholder="Ex: Silva"
                />
              </label>
            </div>
          </fieldset>

          {/* ── Contato ── */}
          <fieldset className="grid gap-4">
            <legend className="text-[11px] font-semibold uppercase tracking-[.08em] text-black/40 mb-1">Contato</legend>
            <label className="grid gap-2 text-sm font-semibold">
              E-mail
              <input
                name="email"
                type="email"
                className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 transition"
                placeholder="email@exemplo.com"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Telefone / WhatsApp
              <div className="flex gap-2">
                <select
                  name="country_code"
                  defaultValue="+55"
                  className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-3 text-sm outline-none focus:border-black/30 transition shrink-0"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                  ))}
                </select>
                <input
                  name="phone"
                  type="tel"
                  className="min-h-[52px] flex-1 rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 transition"
                  placeholder="(00) 90000-0000"
                />
              </div>
            </label>
          </fieldset>

          {/* ── Endereço ── */}
          <fieldset className="grid gap-4">
            <legend className="text-[11px] font-semibold uppercase tracking-[.08em] text-black/40 mb-1">Endereço <span className="normal-case font-normal text-black/30">(opcional)</span></legend>
            <label className="grid gap-2 text-sm font-semibold">
              Rua, número e complemento
              <input
                name="address_line"
                className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 transition"
                placeholder="Rua das Flores, 123 - Apto 4B"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold md:col-span-1">
                CEP
                <input
                  name="zip_code"
                  className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 transition"
                  placeholder="00000-000"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold md:col-span-1">
                Cidade
                <input
                  name="city"
                  className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 transition"
                  placeholder="São Paulo"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold md:col-span-1">
                Estado
                <select
                  name="state"
                  className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 transition"
                >
                  <option value="">—</option>
                  {BRAZIL_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold">
              País
              <input
                name="country"
                defaultValue="Brasil"
                className="min-h-[52px] rounded-xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30 transition"
                placeholder="Brasil"
              />
            </label>
          </fieldset>

          {/* ── Observação ── */}
          <label className="grid gap-2 text-sm font-semibold">
            Observação rápida
            <textarea
              name="notes"
              rows={3}
              className="rounded-xl border border-axiel-line bg-white p-4 text-base outline-none focus:border-black/30 transition"
              placeholder="Algo importante a lembrar sobre este paciente?"
            />
          </label>

          {/* ── Ações ── */}
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              className="min-h-[52px] rounded-lg bg-axiel-blue px-7 text-base font-semibold text-white shadow-md hover:opacity-90 transition"
              type="submit"
            >
              Salvar paciente
            </button>
            <Link
              href="/patients"
              className="inline-flex min-h-[52px] items-center rounded-lg border border-axiel-line bg-white px-7 text-base font-semibold hover:bg-gray-50 transition"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
