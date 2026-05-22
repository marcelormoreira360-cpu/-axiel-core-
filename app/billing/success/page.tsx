import Link from "next/link";
import { Shell } from "@/components/shell";

export default function BillingSuccessPage() {
  return (
    <Shell>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-[#E1F5EE] flex items-center justify-center mb-[20px]">
          <svg className="w-8 h-8 text-[#0F6E56]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98] mb-[6px]">
          Assinatura atualizada
        </p>
        <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[#0F1A2E] mb-[10px]">
          Tudo certo!
        </h1>
        <p className="text-[13px] text-[#A09E98] max-w-[380px] leading-relaxed mb-[28px]">
          O Stripe confirmará sua assinatura via webhook. O acesso da clínica será atualizado automaticamente em instantes.
        </p>
        <div className="flex gap-[10px]">
          <Link href="/dashboard" className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#0A5842] rounded-[8px] px-[18px] py-[10px] transition">
            Ir ao dashboard
          </Link>
          <Link href="/billing" className="text-[12px] font-medium text-[#0F1A2E] border border-black/[.10] hover:bg-[#F4F3EF] rounded-[8px] px-[18px] py-[10px] transition">
            Ver faturamento
          </Link>
        </div>
      </div>
    </Shell>
  );
}
