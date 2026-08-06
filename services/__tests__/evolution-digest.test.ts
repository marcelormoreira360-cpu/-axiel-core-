import { describe, it, expect } from "vitest";
import {
  composeEvolutionDigest,
  buildAssessmentSeries,
} from "@/services/evolution-service";
import type { AssessmentSeries } from "@/services/evolution-service";

// Formatação determinística injetada (sem locale real) para os testes.
const opts = {
  formatDate: (iso: string) => iso.slice(0, 10),
  periodSep: " a ",
  trend: (name: string, from: number, to: number) => `tendencia ${name}: ${from}% para ${to}%`,
};

const rec = (starts_at: string | null, observations: string[], created_at?: string) => ({
  key_observations: observations,
  created_at: created_at ?? null,
  appointments: starts_at ? { starts_at } : null,
});

const series = (name: string, pcts: { date: string; pct: number }[]): AssessmentSeries => ({
  template_id: name,
  name,
  points: pcts.map((p) => ({ date: p.date, score_percentage: p.pct, total_score: 0, max_possible_score: 0 })),
});

describe("composeEvolutionDigest", () => {
  it("retorna null quando não há observação alguma", () => {
    const out = composeEvolutionDigest(
      [rec("2026-08-01T10:00:00Z", []), rec("2026-07-01T10:00:00Z", ["  "])],
      [],
      opts,
    );
    expect(out).toBeNull();
  });

  it("retorna null quando não há registros", () => {
    expect(composeEvolutionDigest([], [], opts)).toBeNull();
  });

  it("deduplica observações (case-insensitive + trim), recentes primeiro", () => {
    const out = composeEvolutionDigest(
      [
        rec("2026-08-05T10:00:00Z", ["Dormiu melhor", "  DORMIU MELHOR "]),
        rec("2026-07-20T10:00:00Z", ["Menos ansiedade", "dormiu melhor"]),
      ],
      [],
      opts,
    );
    expect(out).not.toBeNull();
    expect(out!.bullets).toEqual(["Dormiu melhor", "Menos ansiedade"]);
    expect(out!.sessionsCount).toBe(2);
  });

  it("ordena por starts_at desc independentemente da ordem de entrada", () => {
    const out = composeEvolutionDigest(
      [
        rec("2026-06-01T10:00:00Z", ["Sessao antiga"]),
        rec("2026-08-01T10:00:00Z", ["Sessao recente"]),
      ],
      [],
      opts,
    );
    // O bullet da sessão mais recente vem primeiro.
    expect(out!.bullets[0]).toBe("Sessao recente");
  });

  it("respeita o teto de bullets (maxBullets)", () => {
    const out = composeEvolutionDigest(
      [rec("2026-08-01T10:00:00Z", ["a", "b", "c", "d", "e", "f", "g"])],
      [],
      { ...opts, maxBullets: 3 },
    );
    expect(out!.bullets).toHaveLength(3);
  });

  it("considera só as N sessões mais recentes (limit)", () => {
    const records = Array.from({ length: 8 }, (_, i) =>
      rec(`2026-0${(i % 8) + 1}-01T10:00:00Z`, [`obs ${i}`]),
    );
    const out = composeEvolutionDigest(records, [], { ...opts, limit: 5 });
    expect(out!.sessionsCount).toBe(5);
  });

  it("detecta tendência quando a variação atinge o limiar (default 5)", () => {
    const out = composeEvolutionDigest(
      [rec("2026-08-01T10:00:00Z", ["Evoluindo"])],
      [series("GAD-7", [{ date: "2026-06-01", pct: 72 }, { date: "2026-08-01", pct: 58 }])],
      opts,
    );
    expect(out!.scoreTrend).toEqual({ label: "tendencia GAD-7: 72% para 58%", from: 72, to: 58 });
    expect(out!.text).toContain("tendencia GAD-7: 72% para 58%");
  });

  it("ignora tendência quando o formulário tem só 1 resposta", () => {
    const out = composeEvolutionDigest(
      [rec("2026-08-01T10:00:00Z", ["Obs"])],
      [series("PHQ-9", [{ date: "2026-08-01", pct: 40 }])],
      opts,
    );
    expect(out!.scoreTrend ?? null).toBeNull();
  });

  it("ignora tendência quando a variação é menor que o limiar", () => {
    const out = composeEvolutionDigest(
      [rec("2026-08-01T10:00:00Z", ["Obs"])],
      [series("PHQ-9", [{ date: "2026-06-01", pct: 40 }, { date: "2026-08-01", pct: 43 }])],
      opts,
    );
    expect(out!.scoreTrend ?? null).toBeNull();
  });

  it("escolhe a maior variação entre formulários e usa as 2 respostas mais recentes", () => {
    const out = composeEvolutionDigest(
      [rec("2026-08-01T10:00:00Z", ["Obs"])],
      [
        series("PHQ-9", [{ date: "2026-06-01", pct: 40 }, { date: "2026-08-01", pct: 48 }]),
        series("GAD-7", [
          { date: "2026-05-01", pct: 90 },
          { date: "2026-06-01", pct: 80 },
          { date: "2026-08-01", pct: 50 },
        ]),
      ],
      opts,
    );
    expect(out!.scoreTrend).toEqual({ label: "tendencia GAD-7: 80% para 50%", from: 80, to: 50 });
  });

  it("monta período como intervalo, e como data única quando coincidem", () => {
    const range = composeEvolutionDigest(
      [rec("2026-08-05T10:00:00Z", ["a"]), rec("2026-06-12T10:00:00Z", ["b"])],
      [],
      opts,
    );
    expect(range!.period).toBe("2026-06-12 a 2026-08-05");

    const single = composeEvolutionDigest([rec("2026-08-05T10:00:00Z", ["a"])], [], opts);
    expect(single!.period).toBe("2026-08-05");
  });

  it("usa created_at quando a sessão não tem starts_at", () => {
    const out = composeEvolutionDigest(
      [rec(null, ["Sem agendamento"], "2026-07-15T09:00:00Z")],
      [],
      opts,
    );
    expect(out!.bullets).toEqual(["Sem agendamento"]);
    expect(out!.period).toBe("2026-07-15");
  });

  it("trunca o texto no teto de caracteres com reticências", () => {
    const long = "x".repeat(400);
    const out = composeEvolutionDigest(
      [rec("2026-08-01T10:00:00Z", [long])],
      [],
      { ...opts, maxChars: 50 },
    );
    expect(out!.text.length).toBeLessThanOrEqual(50);
    expect(out!.text.endsWith("…")).toBe(true);
  });

  it("não usa travessão no texto composto", () => {
    const out = composeEvolutionDigest(
      [rec("2026-08-01T10:00:00Z", ["Melhora do sono", "Menos dor"])],
      [series("QRM", [{ date: "2026-06-01", pct: 60 }, { date: "2026-08-01", pct: 40 }])],
      opts,
    );
    expect(out!.text).not.toContain("—");
  });
});

describe("buildAssessmentSeries", () => {
  it("agrupa respostas por template e converte score numérico (string do PostgREST)", () => {
    const out = buildAssessmentSeries([
      { template_id: "t1", score_percentage: "72", filled_at: "2026-06-01", assessment_templates: { name: "GAD-7" } },
      { template_id: "t1", score_percentage: 58, filled_at: "2026-08-01", assessment_templates: [{ name: "GAD-7" }] },
      { template_id: "t2", score_percentage: 40, filled_at: "2026-07-01", assessment_templates: { name: "PHQ-9" } },
    ]);
    const gad = out.find((s) => s.name === "GAD-7");
    expect(gad?.points).toHaveLength(2);
    expect(out).toHaveLength(2);
  });

  it("descarta respostas sem data ou sem score", () => {
    const out = buildAssessmentSeries([
      { template_id: "t1", score_percentage: null, filled_at: "2026-06-01", assessment_templates: { name: "X" } },
      { template_id: "t1", score_percentage: 50, filled_at: null, assessment_templates: { name: "X" } },
    ]);
    expect(out).toHaveLength(0);
  });
});
