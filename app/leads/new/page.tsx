import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { SimplePageHeader } from "@/components/simple-page-header";
import { createLeadAction } from "./actions";

export default function NewLeadPage() {
  return (
    <Shell>
      <SimplePageHeader eyebrow="NOVO LEAD" title="Adicionar lead" helper="Capture o contato rapidamente. O pipeline cuida do resto." />
      <Card className="max-w-2xl p-6">
        <form action={createLeadAction} className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">Nome completo
            <input name="full_name" required className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30" placeholder="Nome do lead" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">E-mail
              <input name="email" type="email" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30" placeholder="email@exemplo.com" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">Telefone
              <input name="phone" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30" placeholder="(00) 90000-0000" />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold">Queixa principal
            <input name="main_complaint" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30" placeholder="Com o que precisa de ajuda?" />
          </label>
          <label className="grid gap-2 text-sm font-semibold">Origem
            <select name="source" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30">
              <option value="instagram">Instagram</option>
              <option value="google">Google</option>
              <option value="facebook">Facebook</option>
              <option value="website">Website</option>
              <option value="referral">Indicação</option>
              <option value="other">Outro</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">Observação rápida
            <textarea name="notes" rows={4} className="rounded-2xl border border-axiel-line bg-white p-4 text-base outline-none focus:border-black/30" placeholder="Sobre o que perguntou?" />
          </label>
          <div className="flex flex-wrap gap-3 pt-2">
            <button className="min-h-14 rounded-lg bg-axiel-blue px-7 text-base font-semibold text-white shadow-md" type="submit">Salvar lead</button>
            <Link href="/leads" className="inline-flex min-h-14 items-center rounded-lg border border-axiel-line bg-white px-7 text-base font-semibold">Cancelar</Link>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
