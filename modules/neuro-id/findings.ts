/**
 * findings.ts — Achados dos questionários (QRM / Q-SNA) para a Anamnese.
 *
 * Pega os ITENS de maior pontuação (>= corte) por seção e monta um resumo em
 * texto para o terapeuta REVISAR, corrigir e validar dentro da Avaliação. Depois
 * de validado, a Anamnese alimenta o Doc 1. Não inventa nada: só organiza o que o
 * paciente respondeu. As pontuações Bio³ seguem intactas (outro caminho).
 */

export type FindingItem = { section: string; text: string; value: number };

export type FindingGroup = {
  /** rótulo do instrumento, ex.: "QRM (Rastreamento Metabólico)" */
  instrument: string;
  kind: "qrm" | "qsna" | "other";
  total: number | null;
  max: number | null;
  items: FindingItem[];
};

/** Faixa do QRM (total): cortes do Centro Brasileiro de Nutrição Funcional. */
export function qrmTotalLabel(total: number | null): string | null {
  if (total === null) return null;
  if (total < 20) return "baixo";
  if (total <= 30) return "limítrofe";
  if (total <= 40) return "acima de 30 (indicativo de hipersensibilidade)";
  if (total <= 100) return "acima de 40 (hipersensibilidade provável)";
  return "acima de 100 (carga sintomática muito alta)";
}

/** Faixa do Q-SNA (total 0–180): cortes da metodologia SNA 360. */
export function qsnaTotalLabel(total: number | null): string | null {
  if (total === null) return null;
  if (total <= 35) return "função autonômica equilibrada";
  if (total <= 70) return "disfunção leve (adaptativa)";
  if (total <= 105) return "disfunção moderada";
  return "disfunção grave";
}

function bandLabel(g: FindingGroup): string | null {
  if (g.kind === "qrm") return qrmTotalLabel(g.total);
  if (g.kind === "qsna") return qsnaTotalLabel(g.total);
  return null;
}

/**
 * Cabeçalhos que iniciam um bloco de achados — âncora para deduplicar ao reimportar
 * (substitui o antigo marcador de texto "ACHADOS...", removido por não ser útil).
 * Mantenha em sincronia com os instrumentos roteados em neuro-id-service
 * (QRM, Q-SNA, Estilo de vida e ambiente, História familiar).
 */
const FINDINGS_BLOCK_RE = /(?:^|\n)(?:QRM:|Q-SNA:|Estilo de vida e ambiente:|História familiar:)/;

/**
 * Remove um bloco de achados anterior (do 1º cabeçalho em diante), preservando o
 * texto humano que vier antes dele. Usado na importação para não duplicar.
 */
export function stripPreviousFindings(prev: string): string {
  const m = FINDINGS_BLOCK_RE.exec(prev);
  if (!m) return prev.trim();
  return prev.slice(0, m.index).trim();
}

/** Cabeçalho curto do grupo (sem "total X/Y"): QRM mostra a faixa; Q-SNA, total + faixa. */
function groupHead(g: FindingGroup): string {
  const band = bandLabel(g);
  if (g.kind === "qrm") return band ? `QRM: ${band}` : "QRM:";
  if (g.kind === "qsna") {
    const num = g.total !== null ? `${g.total}` : "";
    const tail = [num, band].filter(Boolean).join(" ");
    return tail ? `Q-SNA: ${tail}` : "Q-SNA:";
  }
  return `${g.instrument}:`;
}

/**
 * Monta o resumo em texto dos achados. Agrupa por instrumento e, dentro dele, por
 * seção (na ordem em que os itens chegam). Sem travessão "—" (preferência da casa)
 * e sem cabeçalho introdutório (a frase "ACHADOS..." foi removida por não ser útil).
 */
export function formatFindingsSummary(groups: FindingGroup[], _threshold?: number): string {
  const blocks: string[] = [];

  for (const g of groups) {
    if (g.items.length === 0) continue;

    const head = groupHead(g);

    // Agrupa itens por seção preservando a ordem de chegada.
    const bySection: { section: string; items: FindingItem[] }[] = [];
    for (const it of g.items) {
      let bucket = bySection.find((b) => b.section === it.section);
      if (!bucket) { bucket = { section: it.section, items: [] }; bySection.push(bucket); }
      bucket.items.push(it);
    }

    const lines = bySection.map((b) => {
      const itemsTxt = b.items.map((i) => `${i.text} (${i.value})`).join("; ");
      return `- ${b.section}: ${itemsTxt}`;
    });

    blocks.push([head, ...lines].join("\n"));
  }

  return blocks.join("\n\n");
}
