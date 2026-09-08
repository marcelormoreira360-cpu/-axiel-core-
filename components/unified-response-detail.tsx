/**
 * unified-response-detail.tsx — exibição das respostas do FORMULÁRIO UNIFICADO
 * Neuro ID a partir do snapshot cru (assessment_responses.raw_answers).
 *
 * O formulário unificado é renderizado por CÓDIGO (não tem assessment_questions
 * no banco), então a tela de detalhe padrão não o mostra. Aqui percorremos os
 * blocos do template canônico (UNIFIED_FORM, pt-BR — leitura do profissional) e
 * formatamos cada resposta de forma legível: sintomas por frequência × impacto,
 * escalas com âncora/rótulo, escolhas/textos como estão. Só aparecem perguntas
 * efetivamente respondidas. Componente de servidor (sem interação).
 */

import {
  UNIFIED_FORM,
  FREQ_LABELS,
  IMP_LABELS,
  type UnifiedQuestion,
} from "@/modules/neuro-id/unified-form-template";

type Raw = Record<string, unknown>;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Rótulo de uma escala com âncoras — usa a âncora exata ou a mais próxima abaixo. */
function anchorLabel(q: UnifiedQuestion, v: number): string {
  const anchors = q.anchors ?? {};
  if (anchors[v] != null) return `${v} · ${anchors[v]}`;
  const keys = Object.keys(anchors).map(Number).sort((a, b) => a - b);
  let lbl: string | null = null;
  for (const k of keys) if (v >= k) lbl = anchors[k];
  return lbl ? `${v} · ${lbl}` : String(v);
}

/** Valor legível de uma pergunta a partir do snapshot. null = não respondida (some). */
function formatAnswer(q: UnifiedQuestion, raw: Raw): string | null {
  if (q.type === "info") return null;

  if (q.type === "freqimp") {
    const f = num(raw[`${q.code}_freq`]);
    if (f === null) return null;
    if (f === 0) return FREQ_LABELS[0];
    const i = num(raw[`${q.code}_imp`]);
    const freqLbl = FREQ_LABELS[f] ?? String(f);
    const impLbl = i !== null ? IMP_LABELS[i] : null;
    return impLbl ? `${freqLbl} · ${impLbl}` : freqLbl;
  }

  if (q.type === "scale" || q.type === "crisis") {
    const v = num(raw[q.code]);
    if (v === null) return null;
    if (q.anchors) return anchorLabel(q, v);
    if (q.scaleLabels && q.scaleLabels[v] != null) return `${v} · ${q.scaleLabels[v]}`;
    return String(v);
  }

  if (q.type === "multi") {
    const v = raw[q.code];
    if (Array.isArray(v) && v.length > 0) return v.map(String).join(", ");
    return null;
  }

  // yes_no / choice / text / date — valor canônico guardado.
  const v = raw[q.code];
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

export function UnifiedResponseDetail({ rawAnswers }: { rawAnswers: Record<string, unknown> }) {
  const blocks = UNIFIED_FORM.blocks
    .map((b) => ({
      key: b.key,
      title: b.title,
      rows: b.questions
        .map((q) => ({ q, value: formatAnswer(q, rawAnswers), crisis: q.type === "crisis" }))
        .filter((r): r is { q: UnifiedQuestion; value: string; crisis: boolean } => r.value !== null),
    }))
    .filter((b) => b.rows.length > 0);

  if (blocks.length === 0) {
    return (
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <p className="text-[12px] text-[#A09E98]">Nenhuma resposta registrada neste envio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-[12px]">
      {blocks.map((b) => (
        <div key={b.key} className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
          <div className="px-[16px] py-[10px] bg-[#F4F3EF]">
            <p className="text-[11px] font-medium tracking-[.06em] uppercase text-[#6B6A66]">{b.title}</p>
          </div>
          <div className="divide-y divide-black/[.04] dark:divide-white/[.06]">
            {b.rows.map(({ q, value, crisis }) => (
              <div key={q.code} className="flex items-start justify-between px-[16px] py-[10px] gap-[12px]">
                <p className="text-[12px] text-[#6B6A66] flex-1">{q.label}</p>
                <span
                  className={[
                    "text-[12px] font-medium shrink-0 max-w-[55%] text-right",
                    crisis ? "text-[#C0392B] dark:text-[#F2B8B5]" : "text-[#0F1A2E] dark:text-[#E8E6E2]",
                  ].join(" ")}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
