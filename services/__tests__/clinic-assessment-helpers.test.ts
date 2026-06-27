import { describe, it, expect } from "vitest";
import {
  slugifyFieldKey,
  assessmentReportPairs,
  fieldValue,
} from "@/services/clinic-assessment-service";
import type { ClinicAssessmentField } from "@/lib/types";

function field(partial: Partial<ClinicAssessmentField> & Pick<ClinicAssessmentField, "field_key" | "label">): ClinicAssessmentField {
  return {
    id: partial.field_key,
    clinic_id: "c1",
    field_type: "textarea",
    placeholder: null,
    help_text: null,
    options: null,
    order_index: 0,
    group_key: "mediadores",
    is_active: true,
    include_in_report: true,
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

describe("slugifyFieldKey", () => {
  it("normaliza acentos e espaços", () => {
    expect(slugifyFieldKey("Anamnese")).toBe("anamnese");
    expect(slugifyFieldKey("Grau da dor (0–10)")).toBe("grau_da_dor_0_10");
    expect(slugifyFieldKey("Sono / Energia")).toBe("sono_energia");
  });
  it("não deixa underscores nas pontas", () => {
    expect(slugifyFieldKey("  Hábitos!  ")).toBe("habitos");
  });
});

describe("assessmentReportPairs", () => {
  const fields = [
    field({ field_key: "anamnese", label: "Anamnese", order_index: 0 }),
    field({ field_key: "energia", label: "Energia", field_type: "number", order_index: 1 }),
    field({ field_key: "interno", label: "Interno", include_in_report: false, order_index: 2 }),
  ];

  it("inclui só campos marcados para o relatório, com valor, na ordem", () => {
    const patient = { assessment_data: { anamnese: "Queixa X", energia: 7, interno: "segredo" } };
    const pairs = assessmentReportPairs(patient, fields);
    expect(pairs).toEqual([
      { key: "anamnese", label: "Anamnese", value: "Queixa X" },
      { key: "energia", label: "Energia", value: "7" },
    ]);
  });

  it("ignora valores vazios/nulos", () => {
    const patient = { assessment_data: { anamnese: "  ", energia: null } };
    expect(assessmentReportPairs(patient, fields)).toEqual([]);
  });

  it("lida com assessment_data ausente", () => {
    expect(assessmentReportPairs({ assessment_data: null }, fields)).toEqual([]);
  });
});

describe("fieldValue", () => {
  it("retorna valor por chave ou null", () => {
    expect(fieldValue({ assessment_data: { a: "x" } }, "a")).toBe("x");
    expect(fieldValue({ assessment_data: { a: "x" } }, "b")).toBeNull();
    expect(fieldValue({ assessment_data: null }, "a")).toBeNull();
  });
});
