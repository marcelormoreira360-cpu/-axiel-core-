import { describe, it, expect } from "vitest";
import { coerceAiInsightOutput } from "@/modules/ai-insights/insight-schema";
import { scanPatientText, summarizeViolations, hasPersuasiveDoc1, hasPersuasiveDoc2 } from "@/modules/ai-insights/patient-text-guardrails";

/** Base persuasiva LIMPA (com âncora), à qual os testes injetam 1 violação por vez. */
function cleanOutput(overrides: Record<string, unknown> = {}) {
  return coerceAiInsightOutput({
    mapa_integrativo: {
      abertura_calorosa: "Olá, Amanda. Que bom ter você aqui.",
      leitura_neurometrica: [{ titulo: "Seu ritmo interno", descricao: "está acelerado hoje" }],
      ancora_positiva: "Seus freios naturais estão preservados.",
      conexao_aha: "A emoção conversa com o corpo.",
      porque_agir_agora: "Começar agora joga a seu favor.",
      proximo_passo: "Vamos caminhar juntos.",
      ...overrides,
    },
  });
}

describe("scanPatientText — guardrail de texto ao paciente (Rota A)", () => {
  it("texto persuasivo limpo passa sem violações", () => {
    const scan = scanPatientText(cleanOutput());
    expect(scan.ok).toBe(true);
    expect(scan.hasPersuasiveContent).toBe(true);
    expect(scan.violations).toHaveLength(0);
  });

  it("jargão interno (neurometria) vira violação termo_interno", () => {
    const scan = scanPatientText(cleanOutput({ abertura_calorosa: "Sua neurometria mostrou algo." }));
    expect(scan.ok).toBe(false);
    expect(scan.violations).toContainEqual({
      kind: "termo_interno",
      term: "neurometria",
      field: "mapa.abertura_calorosa",
    });
  });

  it("a palavra 'exame' é pega por palavra inteira (não pega 'examinar')", () => {
    const comExame = scanPatientText(cleanOutput({ conexao_aha: "O seu exame revela um padrão." }));
    expect(comExame.violations.some((v) => v.kind === "termo_interno" && v.term === "exame")).toBe(true);
    const semFalsoPositivo = scanPatientText(cleanOutput({ conexao_aha: "Vamos examinar isso juntos." }));
    expect(semFalsoPositivo.ok).toBe(true);
  });

  it("número de sessões (dígito ou 'doze') vira violação numero_sessoes", () => {
    expect(scanPatientText(cleanOutput({ proximo_passo: "São 12 sessões no total." })).violations).toContainEqual(
      { kind: "numero_sessoes", field: "mapa.proximo_passo" },
    );
    expect(scanPatientText(cleanOutput({ proximo_passo: "São doze sessões." })).violations).toContainEqual({
      kind: "numero_sessoes",
      field: "mapa.proximo_passo",
    });
  });

  it("travessão vira violação travessao", () => {
    const scan = scanPatientText(cleanOutput({ conexao_aha: "A emoção — o corpo responde." }));
    expect(scan.violations).toContainEqual({ kind: "travessao", field: "mapa.conexao_aha" });
  });

  it("âncora positiva ausente vira violação — só quando há conteúdo persuasivo", () => {
    const semAncora = coerceAiInsightOutput({
      mapa_integrativo: { abertura_calorosa: "Olá.", conexao_aha: "algo importante." },
    });
    const scan = scanPatientText(semAncora);
    expect(scan.hasPersuasiveContent).toBe(true);
    expect(scan.violations).toContainEqual({ kind: "sem_ancora_positiva" });
  });

  it("insight sem formato persuasivo (legado/vazio) não exige âncora", () => {
    const scan = scanPatientText(coerceAiInsightOutput({}));
    expect(scan.hasPersuasiveContent).toBe(false);
    expect(scan.ok).toBe(true);
  });

  it("varre também os campos do Doc 2 (plano_regulacao)", () => {
    const out = coerceAiInsightOutput({
      mapa_integrativo: { abertura_calorosa: "Olá.", ancora_positiva: "Há forças a seu favor." },
      plano_regulacao: { como_caminhar_juntos: "Seguindo o protocolo de 12 sessões." },
    });
    const scan = scanPatientText(out);
    expect(scan.violations.some((v) => v.kind === "termo_interno" && v.term === "protocolo")).toBe(true);
    expect(scan.violations.some((v) => v.kind === "numero_sessoes")).toBe(true);
  });

  it("summarizeViolations resume em texto legível", () => {
    const scan = scanPatientText(cleanOutput({ abertura_calorosa: "Sua neurometria." }));
    expect(summarizeViolations(scan.violations)).toContain("neurometria");
    expect(summarizeViolations([])).toBe("");
  });
});

describe("hasPersuasiveDoc1 / hasPersuasiveDoc2 — detecção de formato", () => {
  it("Doc 1: detecta formato persuasivo vs legado/vazio", () => {
    expect(hasPersuasiveDoc1(cleanOutput().mapa_integrativo)).toBe(true);
    expect(hasPersuasiveDoc1(coerceAiInsightOutput({}).mapa_integrativo)).toBe(false);
    expect(hasPersuasiveDoc1(null)).toBe(false);
  });

  it("Doc 2: detecta os 4 blocos persuasivos vs legado/vazio", () => {
    const novo = coerceAiInsightOutput({
      plano_regulacao: { onde_queremos_chegar: "Regular o sistema nervoso, no seu ritmo." },
    }).plano_regulacao;
    expect(hasPersuasiveDoc2(novo)).toBe(true);
    const legado = coerceAiInsightOutput({
      plano_regulacao: { direcao_terapeutica: "Eixo principal: regulação autonômica." },
    }).plano_regulacao;
    expect(hasPersuasiveDoc2(legado)).toBe(false);
    expect(hasPersuasiveDoc2(null)).toBe(false);
  });
});
