import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { SimplePageHeader } from "@/components/simple-page-header";
import { createPatientAction } from "./actions";

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  const prefillName = name ? decodeURIComponent(name) : "";

  return (
    <Shell>
      <SimplePageHeader eyebrow="NOVO PACIENTE" title="Adicionar paciente" helper="Apenas as informações essenciais para começar. Você pode adicionar mais depois." />
      <Card className="max-w-2xl p-6">
        <form action={createPatientAction} className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">Nome completo
            <input name="full_name" required defaultValue={prefillName} className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30" placeholder="Nome do paciente" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">E-mail
              <input name="email" type="email" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30" placeholder="email@exemplo.com" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">Telefone
              <input name="phone" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30" placeholder="(00) 90000-0000" />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold">Observação rápida
            <textarea name="notes" rows={4} className="rounded-2xl border border-axiel-line bg-white p-4 text-base outline-none focus:border-black/30" placeholder="Algo importante a lembrar?" />
          </label>
          <div className="flex flex-wrap gap-3 pt-2">
            <button className="min-h-14 rounded-lg bg-axiel-blue px-7 text-base font-semibold text-white shadow-md" type="submit">Salvar paciente</button>
            <Link href="/patients" className="inline-flex min-h-14 items-center rounded-lg border border-axiel-line bg-white px-7 text-base font-semibold">Cancelar</Link>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
