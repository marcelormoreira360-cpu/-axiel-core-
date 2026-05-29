"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error.tsx]", error?.message, error?.digest, error?.stack);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-xl border border-black/[.07] bg-white p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98]">AXIEL Core</p>
        <h1 className="mt-3 text-[22px] font-semibold text-[#0F1A2E]">Algo deu errado</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-[#6B6A66]">
          O sistema protegeu seus dados e parou a ação com segurança. Tente novamente.
          Se o problema persistir, entre em contato com o suporte.
        </p>
        {error?.digest && (
          <p className="mt-3 text-[11px] text-[#A09E98]">Referência: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="mt-6 w-full h-10 rounded-[10px] bg-[#0F1A2E] text-white text-[13px] font-medium hover:bg-[#1a2d4a] transition"
        >
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
