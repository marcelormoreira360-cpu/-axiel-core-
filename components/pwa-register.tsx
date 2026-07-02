"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Show banner if never dismissed, or dismissed >7 days ago
      const dismissedAt = localStorage.getItem("pwa-install-dismissed");
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const shouldShow = !dismissedAt || Date.now() - Number(dismissedAt) > sevenDays;
      if (shouldShow) setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setInstallPrompt(null);
    }
  }

  function handleDismiss() {
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-[#0F1A2E] text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold">Instalar AXIEL Core</p>
        <p className="text-[11px] text-white/50 mt-0.5">Acesso rápido na tela inicial</p>
      </div>
      <button
        onClick={handleInstall}
        className="shrink-0 flex items-center gap-1.5 bg-[#0F6E56] hover:bg-[#085041] text-white text-[12px] font-medium px-3 py-1.5 rounded-lg transition"
      >
        <Download className="h-3.5 w-3.5" />
        Instalar
      </button>
      <button
        onClick={handleDismiss}
        aria-label="Fechar"
        className="shrink-0 text-white/40 hover:text-white/70 transition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
