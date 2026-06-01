"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function UpdatePasswordPage() {
  const t = useTranslations("auth.update");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError(t("mismatch")); return; }
    if (password.length < 8) { setError(t("minLength")); return; }

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) { setError(t("error")); return; }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fff_0,#fbfaf7_48%,#f1eee8_100%)] px-6">
      <div className="w-full max-w-md bg-white rounded-3xl border border-axiel-line shadow-sm p-8 space-y-6">
        <div>
          <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">{tAuth("brand")}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-sm text-black/55">{t("subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <input
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-axiel-gold/30 text-sm"
            />
            <input
              type="password"
              placeholder={t("confirmPlaceholder")}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-axiel-gold/30 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-axiel-ink text-white py-3 text-sm font-medium hover:bg-black disabled:opacity-40 transition"
          >
            {loading ? t("submitting") : t("submit")}
          </button>
        </form>
      </div>
    </main>
  );
}
