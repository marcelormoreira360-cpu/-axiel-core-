// Marcador opcional que a Clara pode incluir na resposta para pedir o envio de
// uma IMAGEM no DM: [[IMG: descrição da imagem]] (aceita IMG|IMAGE|IMAGEM).
//
// O texto do marcador é REMOVIDO da mensagem enviada ao paciente e vira o
// prompt de geração da imagem (worker de mídia, services/outbound-media-service).
// Assim a Clara "decide" mostrar um visual sem que o marcador vaze no texto.

const IMAGE_MARKER_RE = /\[\[\s*(?:IMG|IMAGE|IMAGEM)\s*:\s*([^\]]+?)\s*\]\]/i;

export function parseImageMarker(reply: string): { text: string; prompt: string | null } {
  const m = reply.match(IMAGE_MARKER_RE);
  if (!m) return { text: reply, prompt: null };
  const prompt = m[1].trim();
  const text = reply
    .replace(IMAGE_MARKER_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text, prompt: prompt || null };
}
