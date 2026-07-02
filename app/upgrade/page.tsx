import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SignOutButton } from "@/components/sign-out-button";

// ─── Plan card data ────────────────────────────────────────────────────────────

const FEATURE_KEYS = ["feature1", "feature2", "feature3", "feature4"] as const;

const PLANS = [
  { slug: "starter", name: "Starter", price: "R$ 147/mês", popular: false },
  { slug: "professional", name: "Professional", price: "R$ 297/mês", popular: true },
  { slug: "scale", name: "Scale", price: "R$ 697/mês", popular: false },
] as const;

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function UpgradePage() {
  const t = await getTranslations("upgrade");
  // Verify user is authenticated — unauthenticated access → login
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-[#0F1A2E] flex flex-col">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[.07]">
        <div className="text-[17px] font-semibold tracking-[-0.035em] text-white">
          <span className="text-[#0F6E56]">●</span>{" "}
          <span className="text-[14px]">AXIEL Core</span>
        </div>
        <Link
          href="/billing"
          className="text-[12px] text-white/50 hover:text-white/80 transition"
        >
          {t("viewPlanDetails")}
        </Link>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Heading */}
        <div className="text-center mb-10 max-w-lg">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-5">
            <svg
              className="w-3.5 h-3.5 text-amber-400 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest">
              {t("trialEndedBadge")}
            </span>
          </div>

          <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em] text-white leading-tight mb-3">
            {t("title")}
          </h1>
          <p className="text-[14px] text-white/55 leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={`bg-white rounded-2xl border p-6 flex flex-col relative ${
                plan.popular
                  ? "border-[#0F6E56] shadow-lg shadow-[#0F6E56]/10"
                  : "border-black/[.07]"
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0F6E56] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                  {t("mostPopular")}
                </span>
              )}

              {/* Plan name + price */}
              <div className="mb-4">
                <p className="text-[13px] font-semibold text-[#0F1A2E] mb-1">
                  {plan.name}
                </p>
                <p className="text-[22px] font-bold text-[#0F1A2E] tracking-tight">
                  {plan.price}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {FEATURE_KEYS.map((featureKey) => (
                  <li key={featureKey} className="flex items-start gap-2">
                    <svg
                      className="w-3.5 h-3.5 text-[#0F6E56] mt-0.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-[12px] text-[#4A4A4A] leading-snug">
                      {t(`plans.${plan.slug}.${featureKey}`)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA — vai direto ao checkout do Stripe (mesmo endpoint do /billing) */}
              <form action="/api/stripe/checkout" method="POST">
                <input type="hidden" name="planCode" value={plan.slug} />
                <button
                  type="submit"
                  className={`w-full text-center text-[13px] font-semibold py-2.5 rounded-xl transition ${
                    plan.popular
                      ? "bg-[#0F6E56] text-white hover:bg-[#0a5a46]"
                      : "bg-[#F4F3EF] text-[#0F1A2E] hover:bg-[#EBEBEA]"
                  }`}
                >
                  {t("subscribe", { plan: plan.name })}
                </button>
              </form>
            </div>
          ))}
        </div>

        {/* Trust note */}
        <p className="text-[11px] text-white/30 mt-8 text-center">
          {t("trustNote")}
        </p>
      </main>

      {/* ── Footer ── */}
      <footer className="flex items-center justify-center gap-6 px-6 py-5 border-t border-white/[.07]">
        <Link
          href="/billing"
          className="text-[11px] text-white/40 hover:text-white/70 transition"
        >
          {t("manageSubscription")}
        </Link>
        <span className="text-white/20 text-[10px]">•</span>
        <div className="[&_button]:text-[11px] [&_button]:text-white/40 [&_button]:hover:text-white/70 [&_button]:p-0 [&_button]:h-auto [&_button]:bg-transparent [&_button]:hover:bg-transparent [&_button]:w-auto [&_button]:justify-center">
          <SignOutButton />
        </div>
      </footer>
    </div>
  );
}
