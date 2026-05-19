export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAF8] px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/30">AXIEL Core</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#0F1A2E]">Sem conexão</h1>
      <p className="mt-3 text-base text-black/50 max-w-xs">
        Você está offline. Verifique sua conexão e tente novamente.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-8 rounded-2xl bg-[#0B1F3A] text-white px-8 py-3 text-sm font-medium hover:bg-black transition"
      >
        Tentar novamente
      </button>
    </main>
  );
}
