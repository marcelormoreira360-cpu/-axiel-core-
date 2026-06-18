/**
 * report-copy.ts — Mapa Bio³ · copy do RELATÓRIO DO PACIENTE (7 beats).
 *
 * Copy aprovada por Aval (ciência) + Termo (FDA/FTC) em 2026-06-18
 * (`_COPY_BIO3_RELATORIO.md`). Persuasão ÉTICA: clareza + significado + caminho.
 * Sem cura/garantia/medo (ver PROHIBITED_TERMS). Não recalcula nada — só consome
 * scores existentes. Texto editável por Celso/Verbo sem mexer no layout do PDF.
 *
 * Placeholders: {nome} {indice} {pilar} {hint} {q1} {q2} {sintoma}.
 */

export type CopyBand = "solto" | "tenso" | "bloqueado"; // 0–30 / 31–69 / 70–100
export type CopyPillar = "fisico" | "bioquimico" | "emocional";

export type ReportVars = {
  nome: string;
  indice: number;
  pilar: string; // rótulo do pilar prioritário (ex.: "Bioemocional")
  hint: string;  // ex.: "mente & emoção"
  q1?: string | null;
  q2?: string | null;
  sintoma?: string | null;
};

export type ReportBeat = { title: string; body: string };
export type PatientReportCopy = {
  beats: ReportBeat[];
  authority: string;
  socialProof: string;
  disclaimer: string;
  safeguard: string | null;
};

// §4/§final do brief: termos que NUNCA podem aparecer (match por palavra inteira).
export const PROHIBITED_TERMS = [
  "cura", "garantia", "100%", "sem efeitos colaterais", "definitivo",
];

export function findProhibited(text: string): string[] {
  const hits: string[] = [];
  for (const term of PROHIBITED_TERMS) {
    const re = term === "100%"
      ? /100\s*%/i
      : new RegExp(`(^|[^\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu");
    if (re.test(text)) hits.push(term);
  }
  return hits;
}

function interpolate(tpl: string, vars: ReportVars): string {
  return tpl
    .replaceAll("{nome}", vars.nome || "")
    .replaceAll("{indice}", String(vars.indice))
    .replaceAll("{pilar}", vars.pilar || "")
    .replaceAll("{hint}", vars.hint || "")
    .replaceAll("{q1}", (vars.q1 ?? "").trim())
    .replaceAll("{q2}", (vars.q2 ?? "").trim())
    .replaceAll("{sintoma}", (vars.sintoma ?? "").trim());
}

// ── Beat 1 — "Eu te ouvi" ──
function beat1(vars: ReportVars): string {
  const q1 = (vars.q1 ?? "").trim();
  const q2 = (vars.q2 ?? "").trim();
  if (!q1) {
    // Sem queixa registrada: não inventa — variante honesta.
    return interpolate(
      "{nome}, antes de qualquer número, o mais importante: a gente ouviu você. Este mapa é o primeiro passo pra entender o porquê do que você sente.",
      vars,
    );
  }
  const sobreQ2 = q2 ? " — e também sobre {q2}" : "";
  return interpolate(
    `{nome}, antes de qualquer número, o mais importante: a gente ouviu o que você está sentindo. Você falou sobre {q1}${sobreQ2}. Isso não é frescura nem "coisa da cabeça": são sinais reais do seu corpo, e eles têm explicação. Este mapa é o primeiro passo pra entender o porquê.`,
    vars,
  );
}

// ── Beat 2 — "Seu retrato hoje" (por faixa) ──
const BEAT2: Record<CopyBand, string> = {
  solto: "Reunimos tudo o que avaliamos em um retrato único — o seu Índice Bio. Hoje ele está em {indice}%: você está em função e equilíbrio. Seu corpo está respondendo bem, e o foco agora é proteger e otimizar isso.",
  tenso: "Reunimos tudo o que avaliamos em um retrato único — o seu Índice Bio. Hoje ele está em {indice}%: em disfunção e desequilíbrio crônico. Em bom português, seu corpo vem “segurando as pontas” há um tempo — e isso cobra um preço. A boa notícia: esse quadro costuma responder bem quando cuidamos da causa.",
  bloqueado: "Reunimos tudo o que avaliamos em um retrato único — o seu Índice Bio. Hoje ele está em {indice}%: em grande disfunção e desequilíbrio. Seu corpo vem fazendo um esforço enorme pra te manter de pé e já pede cuidado. Isso não é pra assustar — é pra mostrar que existe um caminho, e ele começa por um ponto específico.",
};

// ── Beat 3 — "O que isso significa no seu dia a dia" (por pilar) ──
const BEAT3: Record<CopyPillar, string> = {
  emocional: "Esse número não é abstrato — ele aparece na sua rotina. Quando o eixo {pilar} pesa, o corpo vive em modo alerta: sono que não descansa, pavio curto, mente acelerada, cansaço que não passa nem dormindo.{sintomaFrase}",
  bioquimico: "Esse número não é abstrato — ele aparece na sua rotina. Quando o eixo {pilar} pesa, é o seu motor interno que sofre: inflamação de baixo grau, intestino irregular, energia e humor oscilando, a sensação de não “absorver” o que come.{sintomaFrase}",
  fisico: "Esse número não é abstrato — ele aparece na sua rotina. Quando o eixo {pilar} pesa, o corpo cobra na estrutura: dor que volta, rigidez, movimentos que travam, tensão que vira dor de cabeça.{sintomaFrase}",
};
const BEAT3_SINTOMA: Record<CopyPillar, string> = {
  emocional: " Pode ser exatamente o que você descreveu sobre {sintoma}.",
  bioquimico: " Combina com o que você relatou sobre {sintoma}.",
  fisico: " Provavelmente é o que está por trás de {sintoma}.",
};

// ── Beat 4 — "Por onde começar (a boa notícia)" (por pilar) ──
const BEAT4_INTRO = "E aqui está a melhor parte — a gente já sabe por onde começar. Seu ponto de maior prioridade hoje é o eixo {pilar} ({hint}). Começar por ele não é aleatório: ";
const BEAT4: Record<CopyPillar, string> = {
  emocional: "na maioria das vezes ele é a origem do desequilíbrio — quando o sistema nervoso acalma, os outros eixos respondem em cascata.",
  bioquimico: "ele é a ponte entre o emocional e o físico — equilibrar sua química interna costuma aliviar corpo e mente ao mesmo tempo.",
  fisico: "liberar a estrutura tira o corpo do estado de defesa e abre espaço pro resto do tratamento funcionar melhor.",
};

// ── Beat 5 — "O caminho" (por faixa) ──
const BEAT5_INTRO = "O Índice Bio é o seu norte. A meta do tratamento é simples de enxergar: vê-lo baixar. ";
const BEAT5: Record<CopyBand, string> = {
  solto: "No seu caso, o caminho é de manutenção inteligente — pequenos ajustes pra você seguir em função e equilíbrio por muito mais tempo.",
  tenso: "No seu caso, o caminho é de recuperação: a cada etapa a gente reavalia e você acompanha a evolução do número, eixo por eixo. Não é da noite pro dia — é consistente.",
  bloqueado: "No seu caso, o caminho é de reorganização profunda, com passos claros. A cada reavaliação você acompanha a evolução do número — preto no branco.",
};

// ── Beat 6 — "Se nada mudar" (por faixa) — Aval/Termo reformulado ──
const BEAT6: Record<CopyBand, string> = {
  solto: "E se você não fizer nada? Por ora, provavelmente tudo bem — mas equilíbrio se mantém com cuidado. Pequenos hábitos hoje evitam grandes ajustes amanhã.",
  tenso: "E se nada mudar? O desequilíbrio crônico tende a se acomodar e cobrar mais caro com o tempo — mais sintomas, menos energia, recuperação mais lenta. Agir agora, enquanto o corpo ainda se adapta, costuma ser o momento mais fácil de virar o jogo.",
  bloqueado: "Com franqueza e cuidado: quadros que seguem em desequilíbrio, sem atenção, costumam exigir mais tempo e esforço para reequilibrar mais adiante e podem favorecer momentos de maior desconforto. Não é uma sentença — e isto não substitui avaliação médica. É justamente por isso que começar a cuidar agora faz diferença.",
};

// ── Beat 7 — "Seu próximo passo" ──
const BEAT7 = "Seu próximo passo é simples: o plano que preparamos começa exatamente pelo eixo {pilar} e cuida dos outros dois em paralelo. Cada sessão tem um porquê dentro deste mapa. Quando você estiver pronto(a), é só dizer — e a gente começa por onde mais importa.";

const AUTHORITY = "Este mapa nasce do método Neuro ID, que olha corpo, química e sistema nervoso como um sistema só — cuidar da causa, não só do sintoma.";
const SOCIAL_PROOF = "Acompanhar a própria evolução ao longo do cuidado costuma ser o que mais motiva os pacientes — cada corpo responde no seu tempo.";
const DISCLAIMER = "Este mapa é uma leitura funcional de bem-estar para orientar o seu cuidado. Não é diagnóstico médico nem substitui avaliação ou tratamento médico. Resultados variam de pessoa para pessoa. Para sintomas que persistem ou se agravam, procure avaliação médica.";
const SAFEGUARD = "Recomendamos também acompanhamento de um profissional de saúde mental. Em caso de pensamentos de se machucar, procure ajuda imediata (CVV 188).";

/** Monta a copy dos 7 beats já resolvida (placeholders interpolados). */
export function buildPatientReportCopy(input: {
  band: CopyBand;
  pillar: CopyPillar;
  vars: ReportVars;
  showSafeguard: boolean;
}): PatientReportCopy {
  const { band, pillar, vars } = input;

  const beat3Tpl = BEAT3[pillar].replace(
    "{sintomaFrase}",
    (vars.sintoma ?? "").trim() ? BEAT3_SINTOMA[pillar] : "",
  );

  const beats: ReportBeat[] = [
    { title: "Eu te ouvi", body: beat1(vars) },
    { title: "Seu retrato hoje", body: interpolate(BEAT2[band], vars) },
    { title: "O que isso significa no seu dia a dia", body: interpolate(beat3Tpl, vars) },
    { title: "Por onde começar", body: interpolate(BEAT4_INTRO + BEAT4[pillar], vars) },
    { title: "O caminho", body: interpolate(BEAT5_INTRO + BEAT5[band], vars) },
    { title: "Se nada mudar", body: interpolate(BEAT6[band], vars) },
    { title: "Seu próximo passo", body: interpolate(BEAT7, vars) },
  ];

  return {
    beats,
    authority: AUTHORITY,
    socialProof: SOCIAL_PROOF,
    disclaimer: DISCLAIMER,
    safeguard: input.showSafeguard ? SAFEGUARD : null,
  };
}

/** Faixa de copy a partir da disfunção 0–100. */
export function copyBandForDysfunction(dysfunction: number | null): CopyBand {
  if (dysfunction === null || dysfunction <= 30) return "solto";
  if (dysfunction <= 69) return "tenso";
  return "bloqueado";
}
