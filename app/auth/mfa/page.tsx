"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function MfaPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.find((f) => f.status === "verified");
    if (!totp) { router.push("/dashboard"); return; }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: totp.id,
      code,
    });

    setLoading(false);

    if (error) {
      setError("Código inválido. Tente novamente.");
      setCode("");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-axiel-cream px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-axiel-line p-8 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs font-medium tracking-widest text-black/40 uppercase">Segurança</p>
          <h1 className="text-2xl font-semibold text-axiel-ink">Verificação 2FA</h1>
          <p className="text-sm text-black/50">Digite o código do seu app autenticador.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
            className="w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:ring-2 focus:ring-axiel-gold/30"
          />
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full rounded-2xl bg-axiel-ink text-white py-3 text-sm font-medium hover:bg-black disabled:opacity-40 transition"
          >
            {loading ? "Verificando..." : "Verificar"}
          </button>
        </form>
      </div>
    </div>
  );
}
