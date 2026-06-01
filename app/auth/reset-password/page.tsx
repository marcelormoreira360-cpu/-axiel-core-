"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.reset");
  const tAuth = useTranslations("auth");
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/update-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);

    if (error) { setError(t("error")); return; }
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff_0,#fbfaf7_48%,#f1eee8_100%)] px-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-axiel-line shadow-sm p-8 space-y-6">
        <div>
          <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">{tAuth("brand")}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-sm text-black/55">
            {t("subtitle")}
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 space-y-1">
            <p className="text-sm font-medium text-emerald-800">{t("sentTitle")}</p>
            <p className="text-sm text-emerald-700">
              {t("sentBody")}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-axiel-gold/30 text-sm"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-axiel-ink text-white py-3 text-sm font-medium hover:bg-black disabled:opacity-40 transition"
            >
              {loading ? t("submitting") : t("submit")}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-black/40">
          <Link href="/auth/login" className="text-axiel-ink hover:underline font-medium">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </main>
  );
}
