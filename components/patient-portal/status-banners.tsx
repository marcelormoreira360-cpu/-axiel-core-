"use client";

import { useTranslations } from "next-intl";

// ── Banners de sucesso (pagamento, compra, assinatura) ────────────────────────
export function PortalSuccessBanners({
  paymentSuccess,
  purchaseSuccess,
  subscriptionSuccess,
}: {
  paymentSuccess: boolean;
  purchaseSuccess: boolean;
  subscriptionSuccess: boolean;
}) {
  const t = useTranslations("portal.dashboard");

  return (
    <>
      {/* Banner de pagamento de sessão confirmado */}
      {paymentSuccess && (
        <div className="rounded-2xl bg-[#F0FAF5] border border-[#0F6E56]/20 p-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F6E56]">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F1A2E]">{t("paymentTitle")}</p>
            <p className="text-xs text-black/50 mt-0.5">{t("paymentDesc")}</p>
          </div>
        </div>
      )}

      {/* Banner de compra confirmada */}
      {purchaseSuccess && (
        <div className="rounded-2xl bg-[#F0FAF5] border border-[#0F6E56]/20 p-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F6E56]">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F1A2E]">{t("purchaseTitle")}</p>
            <p className="text-xs text-black/50 mt-0.5">{t("purchaseDesc")}</p>
          </div>
        </div>
      )}

      {/* Banner de assinatura confirmada */}
      {subscriptionSuccess && (
        <div className="rounded-2xl bg-[#EFF6FF] border border-[#3B82F6]/20 p-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3B82F6]">
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F1A2E]">{t("subTitle")}</p>
            <p className="text-xs text-black/50 mt-0.5">{t("subDesc")}</p>
          </div>
        </div>
      )}
    </>
  );
}
