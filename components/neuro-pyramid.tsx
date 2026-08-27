"use client";

import { useTranslations } from "next-intl";
import { severityColor } from "@/modules/neuro-id/bands";
import type { PyramidDatum } from "@/modules/neuro-id/pyramid";

// ── Pirâmide Bio³ (cor CONTÍNUA verde→amarelo→vermelho pela gravidade do eixo) ─────
// Cor = severidade (disfunção do eixo) · número = PESO do eixo no total (soma 100%).
// Ordem fixa topo→base: Biomecânico (topo) / Bioquímico (meio) / Bioemocional (base).
// Extraída de patient-neuro-id-panel para reuso (painel + mesa de revisão do insight).
export function NeuroPyramid({
  data,
  className = "w-full max-w-[260px] h-auto mx-auto shrink-0",
}: {
  data: PyramidDatum[];
  className?: string;
}) {
  const t = useTranslations("neuroId");
  const polys = ["120,10 150,54 90,54", "90,54 150,54 182,98 58,98", "58,98 182,98 214,142 26,142"];
  const cy = [46, 84, 128];
  return (
    <svg viewBox="0 0 240 152" className={className} role="img" aria-label={t("pyramidAria")}>
      {data.map((d, i) => {
        const c = severityColor(d.dys);
        return (
          <g key={i}>
            <polygon points={polys[i]} fill={c.fillStrong} stroke={c.stroke} strokeWidth={2} />
            <text x={120} y={cy[i]} textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight={700} fill={c.text}>
              {d.share === null ? "—" : `${d.share}%`}
            </text>
            {d.isPriority && <text x={120} y={cy[i] - 14} textAnchor="middle" fontSize={11} fill={c.text}>★</text>}
          </g>
        );
      })}
    </svg>
  );
}
