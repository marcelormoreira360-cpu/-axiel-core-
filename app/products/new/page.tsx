import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { createProductAction } from "./actions";

const CATEGORIES = [
  "Suplementos",
  "Exames/Testes",
  "Dispositivos",
  "Kits",
  "Produtos Digitais",
  "Add-ons de Sessão",
  "Outro",
] as const;

const inputClass =
  "w-full rounded-[10px] border border-black/[.10] bg-white px-[13px] py-[10px] text-[13px] text-[#0F1A2E] placeholder-[#A09E98] outline-none focus:border-[#0F6E56] transition";

const labelClass = "flex flex-col gap-[6px] text-[12px] font-medium text-[#0F1A2E]";

export default function NewProductPage() {
  return (
    <Shell>
      {/* Header */}
      <div className="flex items-center gap-[10px] mb-[24px]">
        <BackLink
          fallbackHref="/products"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </BackLink>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
            Novo produto
          </h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">
            Adicionar item ao catálogo da clínica
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[20px] max-w-2xl">
        <form action={createProductAction} className="grid gap-[16px]">
          {/* Nome */}
          <label className={labelClass}>
            Nome
            <input
              name="name"
              required
              className={inputClass}
              placeholder="Ex: Magnésio Dimalato 300mg"
            />
          </label>

          {/* Categoria */}
          <label className={labelClass}>
            Categoria
            <select name="category" className={inputClass} defaultValue="Outro">
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>

          {/* Descrição */}
          <label className={labelClass}>
            Descrição
            <textarea
              name="description"
              rows={3}
              className={inputClass}
              placeholder="Descrição opcional do produto"
            />
          </label>

          {/* Preço + Custo */}
          <div className="grid grid-cols-2 gap-[12px]">
            <label className={labelClass}>
              Preço (R$)
              <input
                name="price_brl"
                required
                type="text"
                inputMode="decimal"
                className={inputClass}
                placeholder="0,00"
              />
            </label>
            <label className={labelClass}>
              Custo (R$)
              <input
                name="cost_brl"
                type="text"
                inputMode="decimal"
                className={inputClass}
                placeholder="0,00 (opcional)"
              />
            </label>
          </div>

          {/* Estoque + SKU */}
          <div className="grid grid-cols-2 gap-[12px]">
            <label className={labelClass}>
              Quantidade em estoque
              <input
                name="inventory_quantity"
                type="number"
                min="0"
                defaultValue="0"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              SKU
              <input
                name="sku"
                type="text"
                className={inputClass}
                placeholder="Ex: MAG-300 (opcional)"
              />
            </label>
          </div>

          {/* Notas de segurança */}
          <label className={labelClass}>
            Notas de segurança
            <textarea
              name="safety_notes"
              rows={3}
              className={inputClass}
              placeholder="Informações sobre uso seguro, contraindicações, etc. (opcional)"
            />
          </label>

          {/* Actions */}
          <div className="flex flex-wrap gap-[10px] pt-[4px]">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[18px] py-[9px] rounded-lg"
            >
              Salvar produto
            </button>
            <Link
              href="/products"
              className="flex items-center text-[13px] font-medium text-[#6B6A66] bg-[#F4F3EF] hover:bg-[#EEECEA] transition px-[18px] py-[9px] rounded-lg"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </Shell>
  );
}
