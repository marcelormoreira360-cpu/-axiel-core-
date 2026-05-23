"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface SignupFormProps {
  inviteToken?: string;
  prefillEmail?: string;
}

export function SignupForm({ inviteToken, prefillEmail }: SignupFormProps) {
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
      setMessage("A senha deve ter pelo menos 8 caracteres.");
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
      setMessage(error.message);
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
        placeholder="Nome completo"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoComplete="name"
      />
      <input
        className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-axiel-gold/30"
        placeholder="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        readOnly={!!prefillEmail}
      />
      <input
        className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-axiel-gold/30"
        placeholder="Senha (mín. 8 caracteres)"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
        minLength={8}
      />
      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? "Criando conta..." : "Criar conta"}
      </Button>
      {message && <p className="text-sm text-red-600">{message}</p>}
      <p className="text-center text-sm text-black/40">
        Já tem uma conta?{" "}
        <a
          href={inviteToken ? `/auth/login?invite=${inviteToken}&email=${encodeURIComponent(email)}` : "/auth/login"}
          className="text-axiel-ink hover:underline"
        >
          Entrar
        </a>
      </p>
    </form>
  );
}
