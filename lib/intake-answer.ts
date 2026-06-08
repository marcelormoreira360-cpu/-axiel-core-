// Formata a resposta de uma pergunta de intake para exibição legível.
// Respostas de "mapa anatômico" são gravadas como JSON { markers, notes };
// aqui viram um texto curto (nº de pontos + notas).
export function formatIntakeAnswerSummary(answer: unknown): string {
  if (answer == null) return "";
  if (typeof answer === "string") {
    const trimmed = answer.trim();
    if (trimmed.startsWith("{") && trimmed.includes("markers")) {
      try {
        const v = JSON.parse(trimmed) as { markers?: unknown[]; notes?: string };
        const count = Array.isArray(v.markers) ? v.markers.length : 0;
        const notes = (v.notes ?? "").trim();
        const parts: string[] = [];
        if (count > 0) parts.push(count === 1 ? "1 ponto marcado" : `${count} pontos marcados`);
        if (notes) parts.push(notes);
        return parts.join(" — ") || "—";
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return JSON.stringify(answer);
}
