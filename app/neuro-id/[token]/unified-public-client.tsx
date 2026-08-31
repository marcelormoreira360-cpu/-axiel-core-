"use client";

import { useState } from "react";
import NeuroIdUnifiedForm from "@/components/neuroid-unified-form";
import { submitUnifiedFormPublicAction } from "./actions";

type AnswerMap = Record<string, number | string | string[]>;
type Kind = "patient" | "public";

/**
 * Client do LINK do formulário unificado. Renderiza o componente rico em modo
 * `patientFacing` (sem pirâmide ao vivo). Fluxo:
 *  - convite de paciente: preenche → envia → agradece;
 *  - link público: preenche → dados de contato + consentimento → envia → agradece.
 */
export default function UnifiedPublicClient({ token, kind }: { token: string; kind: Kind }) {
  const [step, setStep] = useState<"form" | "contact" | "done" | "error">("form");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Contato (só link público)
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot

  async function send(a: AnswerMap, contact?: Parameters<typeof submitUnifiedFormPublicAction>[2]) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await submitUnifiedFormPublicAction(token, a, contact);
      if (r.ok) setStep("done");
      else {
        setError(r.error ?? "Não foi possível enviar. Tente novamente.");
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar.");
    } finally {
      setSaving(false);
    }
  }

  function handleComplete(a: AnswerMap) {
    setAnswers(a);
    if (kind === "public") {
      setStep("contact");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      void send(a);
    }
  }

  if (step === "done") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
        <p className="mb-2 text-2xl">✅</p>
        <h2 className="mb-1 text-lg font-semibold text-emerald-900 dark:text-emerald-200">Respostas enviadas</h2>
        <p className="text-sm text-emerald-800/80 dark:text-emerald-300/80">
          Obrigado. Suas respostas foram registradas com segurança. A equipe vai revisar antes da sua consulta.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mx-auto mb-3 max-w-2xl rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30">{error}</div>
      )}

      {step === "form" && (
        <NeuroIdUnifiedForm
          patientFacing
          completeLabel={kind === "public" ? "Continuar" : "Enviar respostas"}
          onComplete={handleComplete}
        />
      )}

      {step === "contact" && (
        <form
          className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
          onSubmit={(e) => {
            e.preventDefault();
            void send(answers, {
              full_name: fullName,
              email,
              phone: phone || null,
              date_of_birth: dob || null,
              consent,
              website: website || null,
            });
          }}
        >
          <h2 className="mb-1 text-lg font-semibold">Quase lá</h2>
          <p className="mb-4 text-sm text-neutral-500">Deixe seus dados para a equipe entrar em contato.</p>

          {/* honeypot invisível */}
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />

          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Nome completo *</span>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">E-mail *</span>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
          </label>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Telefone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">Nascimento</span>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800" />
            </label>
          </div>
          <label className="mb-4 flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>Autorizo o contato e o tratamento dos meus dados para fins de avaliação de bem-estar.</span>
          </label>

          <button
            type="submit"
            disabled={saving || !consent}
            className="w-full rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? "Enviando..." : "Enviar"}
          </button>
        </form>
      )}
    </div>
  );
}
