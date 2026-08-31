import { describe, it, expect } from "vitest";
import {
  CANONICAL_JOURNEY_STAGES,
  CLINICAL_STAGE_TO_CANONICAL,
  JOURNEY_STAGE_KIND,
  toCanonicalStage,
  type CanonicalJourneyStage,
} from "../journey";
import type { ClinicalJourneyStage } from "../stage";

/** Os 9 estados clínicos vivos de `stage.ts`, na ordem da união de tipos. */
const ALL_NINE: ClinicalJourneyStage[] = [
  "novo",
  "avaliacao_agendada",
  "avaliado",
  "plano_sugerido",
  "em_tratamento",
  "reavaliacao",
  "manutencao",
  "inativo",
  "reativacao",
];

describe("journey — mapa canônico 9→7", () => {
  it("mapeia cada um dos 9 estados para a etapa canônica esperada", () => {
    const expected: Record<ClinicalJourneyStage, CanonicalJourneyStage> = {
      novo: "prepare",
      avaliacao_agendada: "prepare",
      avaliado: "assess",
      plano_sugerido: "care",
      em_tratamento: "care",
      reavaliacao: "continue",
      manutencao: "continue",
      inativo: "return",
      reativacao: "return",
    };
    for (const stage of ALL_NINE) {
      expect(toCanonicalStage(stage)).toBe(expected[stage]);
    }
  });

  it("cobre exatamente os 9 estados, sem sobra nem falta", () => {
    expect(Object.keys(CLINICAL_STAGE_TO_CANONICAL).sort()).toEqual([...ALL_NINE].sort());
  });

  it("todo destino do mapa é uma etapa canônica válida", () => {
    for (const target of Object.values(CLINICAL_STAGE_TO_CANONICAL)) {
      expect(CANONICAL_JOURNEY_STAGES).toContain(target);
    }
  });

  it("as etapas de EVENTO (understand, follow_up) não são destino de permanência", () => {
    const targets = new Set(Object.values(CLINICAL_STAGE_TO_CANONICAL));
    expect(targets.has("understand")).toBe(false);
    expect(targets.has("follow_up")).toBe(false);
  });

  it("toda etapa canônica tem uma natureza declarada (permanência/evento)", () => {
    for (const stage of CANONICAL_JOURNEY_STAGES) {
      expect(["permanence", "event"]).toContain(JOURNEY_STAGE_KIND[stage]);
    }
    expect(JOURNEY_STAGE_KIND.understand).toBe("event");
    expect(JOURNEY_STAGE_KIND.follow_up).toBe("event");
  });
});
