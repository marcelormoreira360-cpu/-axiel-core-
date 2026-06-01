"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface LoginFormProps {
  inviteToken?: string;
  prefillEmail?: string;
  redirectTo?: string;
}

export function LoginForm({ inviteToken, prefillEmail, redirectTo }: LoginFormProps) {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
        setMessage(t("invalidCredentials"));
      } else {
        setMessage(t("genericError"));
      }
      return;
    }

    // Accept team invite if present
    if (inviteToken && data.user) {
      try {
        await fetch("/api/auth/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken, userId: data.user.id }),
        });
      } catch {
        // Non-fatal — continue to dashboard
      }
      router.push("/dashboard?joined=1");
      router.refresh();
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      router.push("/auth/mfa");
    } else {
      router.push(redirectTo ?? "/dashboard");
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <input
        className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-axiel-gold/30"
        placeholder={t("email")}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        autoComplete="email"
        readOnly={!!prefillEmail}
      />
      <input
        className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-axiel-gold/30"
        placeholder={t("password")}
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        autoComplete="current-password"
      />
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? t("submitting") : t("submit")}
      </Button>
      {message && <p className="text-sm text-red-600">{message}</p>}
      <p className="text-center text-sm text-black/40">
        <a href="/auth/reset-password" className="text-axiel-ink hover:underline">
          {t("forgot")}
        </a>
      </p>
    </form>
  );
}
