"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error.tsx]", error?.message, error?.digest, error?.stack);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-xl border border-black/[.07] bg-white p-8 shadow-sm text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98]">AXIEL Core — Diagnóstico</p>
        <h1 className="mt-3 text-[18px] font-semibold text-[#0F1A2E]">Algo deu errado</h1>

        {/* Visible error for debugging — remover em produção estável */}
        {error?.message && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-[11px] font-semibold text-red-600 mb-1">Erro:</p>
            <p className="text-[11px] text-red-700 font-mono break-all">{error.message}</p>
          </div>
        )}
        {error?.digest && (
          <p className="mt-2 text-[11px] text-[#A09E98] font-mono">digest: {error.digest}</p>
        )}
        {error?.stack && (
          <div className="mt-3 bg-[#F4F3EF] rounded-lg p-3 max-h-32 overflow-auto">
            <p className="text-[10px] font-mono text-[#6B6A66] whitespace-pre-wrap break-all">{error.stack.slice(0, 500)}</p>
          </div>
        )}

        <p className="mt-4 text-[12px] text-[#6B6A66]">
          Abra o Web Inspector (Develop → Show Web Inspector → Console) para ver o erro completo.
        </p>
        <button
          onClick={reset}
          className="mt-4 w-full h-10 rounded-[10px] bg-[#0F1A2E] text-white text-[13px] font-medium hover:bg-[#1a2d4a] transition"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
