import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

/**
 * Guarda de compliance: a copy VISÍVEL da jornada (rótulos de etapa, próxima
 * ação, board, stepper) nunca deve usar linguagem de EXTRAÇÃO nem pôr o
 * sistema como sujeito de ato clínico. O sistema REVELA; a clínica DECIDE e
 * CONTATA. "Return" é continuidade, nunca "reativação".
 *
 * Checa apenas VALORES (não as chaves — o id do estado `reativacao` em
 * stage.ts é estável e não muda).
 */

const LOCALES = ["en", "pt-BR", "pt-PT"] as const;

// Termos banidos nos VALORES da jornada (pt/en).
const FORBIDDEN = /reativ|reactivat|traga.{0,12}de volta|trazer.{0,6}de volta|recuper\w*\s+paciente|win[-\s]?back|bring.{0,8}back/i;

type Entry = { path: string; value: string };

function collectStrings(obj: unknown, prefix: string, out: Entry[]): void {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = `${prefix}.${k}`;
    if (typeof v === "string") out.push({ path: p, value: v });
    else if (v && typeof v === "object") collectStrings(v, p, out);
  }
}

function journeyValues(locale: string): Entry[] {
  const pp = JSON.parse(readFileSync(`messages/${locale}/patientPanels.json`, "utf8"));
  const db = JSON.parse(readFileSync(`messages/${locale}/dashboard.json`, "utf8"));
  const out: Entry[] = [];
  collectStrings(pp?.intelligenceStrip?.journey, "patientPanels.intelligenceStrip.journey", out);
  collectStrings(pp?.journeyStepper, "patientPanels.journeyStepper", out);
  collectStrings(db?.journeyBoard, "dashboard.journeyBoard", out);
  return out;
}

describe("compliance — copy da jornada sem linguagem de extração", () => {
  for (const locale of LOCALES) {
    it(`${locale}: nenhum VALOR da jornada usa termos banidos`, () => {
      const offenders = journeyValues(locale)
        .filter((e) => FORBIDDEN.test(e.value))
        .map((o) => `${o.path} = "${o.value}"`);
      expect(offenders).toEqual([]);
    });

    it(`${locale}: há copy de jornada para checar (guarda contra caminho vazio)`, () => {
      expect(journeyValues(locale).length).toBeGreaterThan(10);
    });
  }
});
