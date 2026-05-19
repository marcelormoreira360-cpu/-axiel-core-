"use client";

import { useState, useEffect } from "react";
import { Shield, ShieldCheck, QrCode, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Factor = { id: string; status: "verified" | "unverified"; factor_type: string };

export function MfaSettings() {
  const supabase = createSupabaseBrowserClient();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadFactors(); }, []);

  async function loadFactors() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
    setLoading(false);
  }

  async function startEnrollment() {
    setError("");
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) { setError(error?.message ?? "Erro ao iniciar cadastro"); return; }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setCode("");
    setEnrolling(true);
  }

  async function confirmEnrollment() {
    if (!factorId) return;
    setSaving(true);
    setError("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setSaving(false);
    if (error) { setError("Código inválido. Tente novamente."); setCode(""); return; }
    setEnrolling(false);
    setQrCode(null);
    setSecret(null);
    setCode("");
    await loadFactors();
  }

  async function cancelEnrollment() {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId });
    setEnrolling(false);
    setQrCode(null);
    setSecret(null);
    setCode("");
    setError("");
  }

  async function unenroll(id: string) {
    await supabase.auth.mfa.unenroll({ factorId: id });
    await loadFactors();
  }

  const verified = factors.filter((f) => f.status === "verified");
  const isEnabled = verified.length > 0;

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-axiel-line bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isEnabled
            ? <ShieldCheck className="h-5 w-5 text-emerald-600" />
            : <Shield className="h-5 w-5 text-black/30" />}
          <div>
            <p className="text-sm font-semibold text-axiel-ink">Autenticação em dois fatores (2FA)</p>
            <p className="text-xs text-black/40 mt-0.5">
              {isEnabled
                ? "Ativo — sua conta está protegida com TOTP."
                : "Adicione uma camada extra de segurança ao seu login."}
            </p>
          </div>
        </div>
        {!isEnabled && !enrolling && (
          <button
            onClick={startEnrollment}
            className="text-xs font-medium text-white bg-axiel-ink hover:bg-black rounded-xl px-4 py-2 transition"
          >
            Ativar 2FA
          </button>
        )}
      </div>

      {isEnabled && verified.map((f) => (
        <div key={f.id} className="flex items-center justify-between rounded-xl border border-axiel-line px-4 py-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-black/40" />
            <span className="text-xs text-axiel-ink">App autenticador (TOTP)</span>
            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">ativo</span>
          </div>
          <button
            onClick={() => unenroll(f.id)}
            className="text-xs text-red-500 hover:text-red-700 transition"
          >
            Remover
          </button>
        </div>
      ))}

      {enrolling && qrCode && (
        <div className="rounded-xl border border-axiel-line p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-axiel-ink">Configure seu app autenticador</p>
            <button onClick={cancelEnrollment} className="text-black/30 hover:text-black transition">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-black/50">
            Escaneie o QR code com Google Authenticator, Authy ou similar. Em seguida, insira o código gerado.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="QR Code 2FA" className="w-40 h-40 rounded-xl mx-auto border border-axiel-line" />
          {secret && (
            <p className="text-center text-[10px] text-black/40 font-mono break-all">
              Código manual: {secret}
            </p>
          )}
          <div className="space-y-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-axiel-line px-4 py-2.5 text-sm text-center tracking-widest outline-none focus:ring-2 focus:ring-axiel-gold/30"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              onClick={confirmEnrollment}
              disabled={saving || code.length < 6}
              className="w-full text-sm font-medium text-white bg-axiel-ink hover:bg-black disabled:opacity-40 rounded-xl py-2.5 transition"
            >
              {saving ? "Confirmando..." : "Confirmar e ativar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
