import { describe, it, expect } from "vitest";
import { ageFromDob, patientIdentificacao } from "../patient-demographics";

const NOW = new Date("2026-06-18T12:00:00");

describe("ageFromDob", () => {
  it("idade derivada de date_of_birth", () => {
    expect(ageFromDob("1990-01-01", NOW)).toBe(36);
    expect(ageFromDob("2000-06-18", NOW)).toBe(26); // aniversário hoje
    expect(ageFromDob("2000-06-19", NOW)).toBe(25); // aniversário amanhã → ainda 25
  });
  it("vazio/ inválido → null", () => {
    expect(ageFromDob(null, NOW)).toBeNull();
    expect(ageFromDob("", NOW)).toBeNull();
    expect(ageFromDob("xxxx", NOW)).toBeNull();
  });
});

describe("patientIdentificacao", () => {
  it("formata idade/sexo/peso/altura/local do cadastro", () => {
    const id = patientIdentificacao(
      { full_name: "Ana", date_of_birth: "1990-01-01", sex: "feminino", weight_kg: 68, height_cm: 170, city: "Recife", state: "PE" },
      NOW,
    );
    expect(id.idade).toBe("36 anos");
    expect(id.sexo).toBe("feminino");
    expect(id.peso).toBe("68 kg");
    expect(id.altura).toBe("170 cm");
    expect(id.local).toBe("Recife / PE");
  });
  it("campos vazios → null (vira 'Não informado' no gerador)", () => {
    const id = patientIdentificacao({ full_name: "Ana" }, NOW);
    expect(id.idade).toBeNull();
    expect(id.sexo).toBeNull();
    expect(id.peso).toBeNull();
    expect(id.altura).toBeNull();
    expect(id.local).toBeNull();
  });
});
