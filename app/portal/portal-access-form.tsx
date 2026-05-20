"use client";

import { useActionState } from "react";
import { sendPortalAccessAction, type SendPortalAccessState } from "./actions";

export function PortalAccessForm() {
  const [state, formAction, isPending] = useActionState<SendPortalAccessState, FormData>(
    sendPortalAccessAction,
    null
  );

  if (state?.sent) {
    return (
      <div className="text-center space-y-3 py-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F0FAF5]">
          <svg
            className="h-6 w-6 text-[#0F6E56]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-[#0F1A2E]">Verifique seu e-mail</h2>
        <p className="text-sm text-black/50 leading-relaxed">
          Se o endereço informado estiver cadastrado, você receberá um link de acesso em instantes.
          O link expira em 24 horas.
        </p>
        <p className="text-xs text-black/35 pt-2">
          Não recebeu?{" "}
          <button
            type="button"
            className="text-[#0F6E56] font-medium hover:underline"
            onClick={() => {
              // Let React reset state by unmounting — handled via key trick below.
              // For now, a full page reload is safe and simple.
              window.location.reload();
            }}
          >
            Tentar novamente
          </button>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-[#0F1A2E]">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="seu@email.com"
          className="w-full rounded-xl border border-black/[.12] bg-white px-4 py-3 text-sm text-[#0F1A2E] placeholder-black/30 outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15 disabled:opacity-50"
          disabled={isPending}
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-[#0F6E56] py-3 text-sm font-semibold text-white transition hover:bg-[#0a5b47] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "Enviando…" : "Enviar link de acesso"}
      </button>
    </form>
  );
}
