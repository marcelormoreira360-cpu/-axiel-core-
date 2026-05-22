import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { ProductForm } from "@/components/product-form";

export default function NewProductPage() {
  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[20px]">
        <Link
          href="/products"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Novo produto</h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">Adicionar item ao catálogo da clínica</p>
        </div>
      </div>

      <ProductForm />
    </Shell>
  );
}
