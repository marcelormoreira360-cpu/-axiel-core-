/**
 * report-copy.ts — Mapa Bio³ · copy do RELATÓRIO DO PACIENTE (7 beats).
 *
 * Copy aprovada por Aval (ciência) + Termo (FDA/FTC) em 2026-06-18
 * (`_COPY_BIO3_RELATORIO.md`). Persuasão ÉTICA: clareza + significado + caminho.
 * Sem cura/garantia/medo (ver PROHIBITED_TERMS). Não recalcula nada — só consome
 * scores existentes. Texto editável por Celso/Verbo sem mexer no layout do PDF.
 *
 * Placeholders: {nome} {indice} {equilibrio} {pilar} {hint} {q1} {q2} {sintoma}.
 *
 * OXIEL dual language: o número mostrado ao paciente é EQUILÍBRIO ({equilibrio} = 100 −
 * disfunção; maior = melhor). A FAIXA (solto/tenso/bloqueado) continua vindo da disfunção
 * crua via copyBandForDysfunction. Copy de equilíbrio revisada por Aval + Termo (02/09/2026).
 */

export type CopyBand = "solto" | "tenso" | "bloqueado"; // 0–30 / 31–69 / 70–100
export type CopyPillar = "fisico" | "bioquimico" | "emocional";

export type ReportVars = {
  nome: string;
  indice: number;      // índice de DISFUNÇÃO (interno; mantido para compatibilidade)
  equilibrio: number;  // índice de EQUILÍBRIO exibido ao paciente (= 100 − disfunção)
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
    .replaceAll("{equilibrio}", String(vars.equilibrio))
    .replaceAll("{pilar}", vars.pilar || "")
    .replaceAll("{hint}", vars.hint || "")
    .replaceAll("{q1}", (vars.q1 ?? "").trim())
    .replaceAll("{q2}", (vars.q2 ?? "").trim())
    .replaceAll("{sintoma}", (vars.sintoma ?? "").trim());
}

// ── Beat 1 — "Nós te ouvimos" ──
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
  const sobreQ2 = q2 ? ", e também sobre {q2}" : "";
  return interpolate(
    `{nome}, antes de qualquer número, o mais importante: a gente ouviu o que você está sentindo. Você falou sobre {q1}${sobreQ2}. Isso não é frescura nem "coisa da cabeça": são sinais reais do seu corpo, e eles têm explicação. Este mapa é o primeiro passo pra entender o porquê.`,
    vars,
  );
}

// ── Beat 2 — "Seu retrato hoje" (por faixa) ──
const BEAT2: Record<CopyBand, string> = {
  solto: "Reunimos tudo o que avaliamos em um retrato único, o seu Índice Bio³ de equilíbrio. Hoje ele está em {equilibrio}%: nesse retrato seu equilíbrio está alto. As áreas avaliadas vêm se mantendo bem, e o foco agora é proteger e sustentar isso.",
  tenso: "Reunimos tudo o que avaliamos em um retrato único, o seu Índice Bio³ de equilíbrio. Hoje ele está em {equilibrio}%: há um equilíbrio parcial, com áreas que vêm “segurando as pontas” há um tempo e isso cobra um preço. A boa notícia é que esse quadro costuma responder bem quando cuidamos da causa.",
  bloqueado: "Reunimos tudo o que avaliamos em um retrato único, o seu Índice Bio³ de equilíbrio. Hoje ele está em {equilibrio}%: o equilíbrio está reduzido, e seu corpo vem fazendo um esforço grande pra te manter de pé. Isso não é pra assustar: é pra mostrar que existe um caminho de cuidado, e ele começa por um ponto específico.",
};

// ── Beat 3 — "O que isso significa no seu dia a dia" (por pilar) ──
const BEAT3: Record<CopyPillar, string> = {
  emocional: "Esse número aparece na sua rotina. Quando o eixo {pilar} pesa, o corpo vive em modo alerta: sono que não descansa, pavio curto, mente acelerada, cansaço que não passa nem dormindo.{sintomaFrase}",
  bioquimico: "Esse número aparece na sua rotina. Quando o eixo {pilar} pesa, é o seu motor interno que sofre: inflamação de baixo grau, intestino irregular, energia e humor oscilando, a sensação de não “absorver” o que come.{sintomaFrase}",
  fisico: "Esse número aparece na sua rotina. Quando o eixo {pilar} pesa, o corpo cobra na estrutura: dor que volta, rigidez, movimentos que travam, tensão que vira dor de cabeça.{sintomaFrase}",
};
const BEAT3_SINTOMA: Record<CopyPillar, string> = {
  emocional: " Pode ser exatamente o que você descreveu sobre {sintoma}.",
  bioquimico: " Combina com o que você relatou sobre {sintoma}.",
  fisico: " Provavelmente é o que está por trás de {sintoma}.",
};

// ── Beat 4 — "Por onde começar (a boa notícia)" (por pilar) ──
const BEAT4_INTRO = "E tem uma boa notícia: a gente já sabe por onde começar. Seu ponto de maior prioridade hoje é o eixo {pilar} ({hint}). Começar por ele não é à toa: ";
const BEAT4: Record<CopyPillar, string> = {
  emocional: "na maioria das vezes ele é a origem do desequilíbrio: quando o sistema nervoso acalma, os outros eixos respondem junto.",
  bioquimico: "ele é a ponte entre o emocional e o físico: equilibrar sua química interna costuma aliviar corpo e mente ao mesmo tempo.",
  fisico: "liberar a estrutura tira o corpo do estado de defesa e abre espaço pro resto do tratamento funcionar melhor.",
};

// ── Beat 5 — "O caminho" (por faixa) ──
const BEAT5_INTRO = "O seu Índice Bio³ de equilíbrio é o seu norte. A meta do cuidado é simples de enxergar: apoiar seu equilíbrio para que ele tenda a subir ao longo do acompanhamento. ";
const BEAT5: Record<CopyBand, string> = {
  solto: "No seu caso, o caminho é de manutenção inteligente: pequenos ajustes pra você seguir em função e equilíbrio por muito mais tempo.",
  tenso: "No seu caso, o caminho é de recuperação: a cada etapa a gente reavalia e você acompanha como o seu equilíbrio evolui, eixo por eixo. Não é da noite pro dia, é consistente.",
  bloqueado: "No seu caso, o caminho é de reorganização profunda, com passos claros. A cada reavaliação você acompanha a evolução do seu equilíbrio, medido e registrado, preto no branco.",
};

// ── Beat 6 — "Se nada mudar" (por faixa) — Aval/Termo reformulado ──
const BEAT6: Record<CopyBand, string> = {
  solto: "E se você não fizer nada? Por ora, provavelmente tudo bem, mas equilíbrio se mantém com cuidado. Pequenos hábitos hoje evitam grandes ajustes amanhã.",
  tenso: "E se nada mudar? Sem cuidado, é comum a pessoa sentir que custa mais para recuperar energia e disposição com o tempo. Agir agora, enquanto o corpo ainda se adapta, costuma ser o momento mais fácil de virar o jogo.",
  bloqueado: "Com franqueza e cuidado: quadros que seguem sem atenção costumam pedir mais tempo de cuidado adiante. Não é uma sentença nem uma previsão sobre você, e isto não substitui avaliação médica. Por isso, começar cedo tende a deixar o caminho mais tranquilo.",
};

// ── Beat 7 — "Seu próximo passo" ──
const BEAT7 = "Seu próximo passo é simples: o plano que preparamos começa exatamente pelo eixo {pilar} e cuida dos outros dois em paralelo. Cada sessão tem um porquê dentro deste mapa. Quando você estiver pronto(a), é só dizer, e a gente começa por onde mais importa.";

const AUTHORITY = "Este mapa nasce do método Neuro ID, que olha corpo, química e sistema nervoso como um sistema só: cuidar da causa, não só do sintoma.";
const SOCIAL_PROOF = "Acompanhar a própria evolução ao longo do cuidado costuma ser o que mais motiva os pacientes. Cada corpo responde no seu tempo.";
const DISCLAIMER = "Este mapa é uma leitura funcional de bem-estar para orientar o seu cuidado. O Índice Bio³ de equilíbrio é um número do nosso método, usado para acompanhar sua evolução e organizar o cuidado: não é uma medida médica, laboratorial ou de diagnóstico, e não deve ser lido como percentual de saúde. Não é diagnóstico médico nem substitui avaliação ou tratamento médico. Resultados variam de pessoa para pessoa. Para sintomas que persistem ou se agravam, procure avaliação médica.";
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
    { title: "Nós te ouvimos", body: beat1(vars) },
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
