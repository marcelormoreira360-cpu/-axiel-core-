"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode, MouseEvent } from "react";

/**
 * Botão "voltar" inteligente: volta no histórico real do navegador (de onde o
 * usuário veio), com um href de segurança quando não há histórico para voltar.
 *
 * Antes cada página usava um <Link href="..."> fixo, então "voltar" sempre ia
 * pro mesmo lugar, ignorando de onde você chegou (o que causava o "voltou pro
 * lugar errado"). Aqui:
 *  - clique normal + há histórico  → router.back() (volta de onde veio)
 *  - sem histórico (acesso direto) → navega para `fallbackHref`
 *  - cmd/ctrl/clique do meio        → comportamento padrão do link (abre o
 *    fallback em nova aba), sem sequestrar o clique.
 *
 * Mantém className/children de cada chamada, então é um drop-in do <Link>.
 */
export function BackLink({
  fallbackHref,
  className,
  title,
  "aria-label": ariaLabel,
  children,
}: {
  fallbackHref: string;
  className?: string;
  title?: string;
  "aria-label"?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    // Deixa o navegador lidar com novo-tab / janela (modificadores, botão do meio).
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
    // Sem histórico: segue o href de fallback (navegação normal do <Link>).
  }

  return (
    <Link href={fallbackHref} onClick={handleClick} className={className} title={title} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
