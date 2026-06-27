import { describe, it, expect } from "vitest";
import { ASSESSMENT_GROUP_ORDER, groupForFieldKey, groupForField } from "@/lib/assessment-groups";

describe("assessment-groups (ATM)", () => {
  it("ordem da espinha ATM", () => {
    expect(ASSESSMENT_GROUP_ORDER).toEqual([
      "objetivo", "antecedentes", "gatilhos", "mediadores", "integracao",
    ]);
  });

  it("mapeia os campos padrão para o grupo certo", () => {
    expect(groupForFieldKey("objetivo")).toBe("objetivo");
    expect(groupForFieldKey("antecedents")).toBe("antecedentes");
    expect(groupForFieldKey("linha_do_tempo")).toBe("gatilhos");
    expect(groupForFieldKey("anamnese")).toBe("mediadores");
    expect(groupForFieldKey("pain_level")).toBe("mediadores");
    expect(groupForFieldKey("integracao_atm")).toBe("integracao");
    expect(groupForFieldKey("treatment_note")).toBe("integracao");
  });

  it("campo custom desconhecido cai em mediadores", () => {
    expect(groupForFieldKey("campo_qualquer_da_clinica")).toBe("mediadores");
  });

  describe("groupForField (group_key da config manda)", () => {
    it("usa group_key quando válido (config sobrepõe o mapa)", () => {
      // Anamnese reclassificada para 'objetivo' na config → respeita a config.
      expect(groupForField({ field_key: "anamnese", group_key: "objetivo" })).toBe("objetivo");
    });
    it("faz fallback no mapa por field_key quando group_key ausente/ inválido", () => {
      expect(groupForField({ field_key: "anamnese", group_key: null })).toBe("mediadores");
      expect(groupForField({ field_key: "antecedents", group_key: "xpto" })).toBe("antecedentes");
      expect(groupForField({ field_key: "campo_custom" })).toBe("mediadores");
    });
  });
});
