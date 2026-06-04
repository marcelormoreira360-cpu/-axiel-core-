import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const cancelled = status === "cancelado";
  const t = await getTranslations("finance.paid");

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F4F3EF] px-6">
      <div className="bg-white border border-black/[.07] rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
        <div
          className={`mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full ${
            cancelled ? "bg-amber-50 text-amber-600" : "bg-[#E1F5EE] text-[#0F6E56]"
          }`}
        >
          <span className="text-2xl leading-none">{cancelled ? "!" : "✓"}</span>
        </div>
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0F1A2E]">
          {cancelled ? t("cancelled") : t("title")}
        </h1>
        <p className="mt-2 text-[13px] text-[#6B6A66]">
          {cancelled ? t("cancelledNote") : t("subtitle")}
        </p>
        {!cancelled && <p className="mt-4 text-[12px] text-[#A09E98]">{t("note")}</p>}
      </div>
    </main>
  );
}
