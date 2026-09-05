"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de submit para `<form action={serverAction}>` que mostra o estado
 * "trabalhando" enquanto a ação roda (useFormStatus). Sem isso, forms com
 * server action ficam parados durante o processamento e passam a sensação de
 * travado. Drop-in para `<button type="submit">` — ele já cuida do type e
 * desabilita durante o envio (evita duplo clique).
 *
 * No estado pendente mostra um spinner em `currentColor` (adapta à cor do texto
 * do botão) ao lado do próprio conteúdo do botão, sem exigir i18n. Precisa estar
 * DENTRO do `<form>`. Não use em botões cujo conteúdo é um layout especial
 * (card multi-linha, knob de toggle) — nesses casos use `<button>` normal.
 */
export function SubmitButton({
  children,
  className = "",
  disabled,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled" | "className">) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={className} {...rest}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-[6px]">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"
          />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
