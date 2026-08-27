import { describe, it, expect } from "vitest";
import { pyramidDataFromMap } from "@/modules/neuro-id/pyramid";

describe("pyramidDataFromMap", () => {
  it("mapa nulo → 3 andares com dys/share nulos, sem prioridade", () => {
    const r = pyramidDataFromMap(null);
    expect(r).toHaveLength(3);
    expect(r.every((d) => d.dys === null && d.share === null && d.isPriority === false)).toBe(true);
  });

  it("ordem topo→base = físico/bioquímico/emocional e shares somam 100", () => {
    const r = pyramidDataFromMap({ fisico_pct: 25, bioquimico_pct: 9, emocional_pct: 13 });
    expect(r).toHaveLength(3);
    expect(r[0].dys).toBe(25); // físico (topo)
    expect(r[1].dys).toBe(9); // bioquímico (meio)
    expect(r[2].dys).toBe(13); // emocional (base)
    const shares = r.map((d) => d.share ?? 0);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("marca o eixo mais disfuncional como prioritário", () => {
    const r = pyramidDataFromMap({ fisico_pct: 60, bioquimico_pct: 10, emocional_pct: 20 });
    expect(r[0].isPriority).toBe(true); // físico é o pior
    expect(r[1].isPriority).toBe(false);
  });
});
