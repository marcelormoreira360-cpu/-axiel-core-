/**
 * Spinner inline para botões de IA com texto branco sobre fundo verde.
 * Mesmo padrão visual dos outros geradores de IA do app (sessão, financeiro,
 * agente de saúde) — dá ao terapeuta o sinal de "IA trabalhando" enquanto a
 * ação processa, evitando a sensação de que travou.
 */
export function AiButtonSpinner({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block rounded-full border-2 border-white/40 border-t-white animate-spin ${className}`}
    />
  );
}
