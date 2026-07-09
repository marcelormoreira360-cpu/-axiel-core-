"use client";

// Dialog de confirmação do app: substitui o confirm() nativo do browser.
// Acessível (role="alertdialog", foco no botão de confirmar, Esc fecha),
// dark-mode aware e com estado de loading enquanto a ação async roda.
// Segue o visual dos modais existentes (ex.: create-session-modal).

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  /** Título do dialog (default: common.confirmDialog.title) */
  title?: string;
  /** Texto da pergunta de confirmação */
  description: string;
  /** Label do botão de confirmar (default: common.actions.confirm; se destrutivo, common.actions.delete) */
  confirmLabel?: string;
  /** Label do botão de cancelar (default: common.actions.cancel) */
  cancelLabel?: string;
  /** Variante destrutiva (vermelha) para exclusões */
  destructive?: boolean;
  /** Ação executada ao confirmar; se async, o botão mostra loading */
  onConfirm: () => void | Promise<void>;
  /** Fecha o dialog (cancelar, Esc, backdrop e após confirmar) */
  onClose: () => void;
}) {
  const t = useTranslations("common");
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const resolvedTitle = title ?? t("confirmDialog.title");
  const resolvedConfirm = confirmLabel ?? (destructive ? t("actions.delete") : t("actions.confirm"));
  const resolvedCancel = cancelLabel ?? t("actions.cancel");

  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={resolvedCancel}
        onClick={() => { if (!loading) onClose(); }}
        className="absolute inset-0 bg-[#0F1A2E]/30 backdrop-blur-[2px]"
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-[400px] bg-white dark:bg-[#111827] rounded-[16px] border border-black/[.08] dark:border-white/[.08] shadow-xl p-6"
      >
        <h2
          id={titleId}
          className="text-[15px] font-medium tracking-[-0.02em] text-[#0F1A2E] dark:text-[#E8E6E2]"
        >
          {resolvedTitle}
        </h2>
        <p
          id={descId}
          className="mt-2 text-[12px] leading-relaxed text-[#6B6A66] dark:text-[#9E9C97]"
        >
          {description}
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 text-[12px] font-medium text-[#6B6A66] dark:text-[#9E9C97] border border-black/[.10] dark:border-white/[.10] rounded-[8px] py-[9px] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] disabled:opacity-50 transition"
          >
            {resolvedCancel}
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={handleConfirm}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-[6px] text-[12px] font-medium text-white rounded-[8px] py-[9px] disabled:opacity-60 transition ${
              destructive
                ? "bg-[#B42318] hover:bg-[#912018]"
                : "bg-[#0F6E56] hover:bg-[#085041]"
            }`}
          >
            {loading && (
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin"
              />
            )}
            {resolvedConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
