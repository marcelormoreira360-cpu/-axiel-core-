"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface SignupFormProps {
  inviteToken?: string;
  prefillEmail?: string;
}

export function SignupForm({ inviteToken, prefillEmail }: SignupFormProps) {
  const t = useTranslations("auth.signup");
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (password.length < 8) {
      setMessage(t("errors.minLength"));
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
      },
    });

    if (error) {
      // L-01: translate Supabase's English error messages to PT-BR
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("email address is already")) {
        setMessage(t("errors.alreadyRegistered"));
      } else if (msg.includes("invalid email") || msg.includes("email is invalid")) {
        setMessage(t("errors.invalidEmail"));
      } else if (msg.includes("password") && msg.includes("characters")) {
        setMessage(t("errors.minLength"));
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        setMessage(t("errors.rateLimit"));
      } else if (msg.includes("signup") && msg.includes("disabled")) {
        setMessage(t("errors.disabled"));
      } else {
        setMessage(t("errors.generic"));
      }
      setLoading(false);
      return;
    }

    // If there is an invite token, accept it via server action
    if (inviteToken && data.user) {
      try {
        const res = await fetch("/api/auth/accept-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken, userId: data.user.id }),
        });
        if (res.ok) {
          router.push("/dashboard?joined=1");
          return;
        }
      } catch {
        // Invite acceptance failed — still continue to onboarding
      }
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <input
        className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-axiel-gold/30"
        placeholder={t("fullName")}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoComplete="name"
      />
      <input
        className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-axiel-gold/30"
        placeholder={t("email")}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        readOnly={!!prefillEmail}
      />
      <input
        className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-axiel-gold/30"
        placeholder={t("passwordHint")}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={8}
      />
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? t("submitting") : t("submit")}
      </Button>
      {message && <p className="text-sm text-red-600">{message}</p>}
      <p className="text-center text-sm text-black/40">
        {t("hasAccount")}{" "}
        <a
          href={inviteToken ? `/auth/login?invite=${inviteToken}&email=${encodeURIComponent(email)}` : "/auth/login"}
          className="text-axiel-ink hover:underline"
        >
          {t("login")}
        </a>
      </p>
    </form>
  );
}
