"use client";

/**
 * neuroid-unified-form.tsx — tela do FORMULÁRIO UNIFICADO Neuro ID.
 *
 * Renderiza `UNIFIED_FORM` (fonte de verdade em código) com a UX aprovada:
 * freq×impacto em duas perguntas, humor em faixas (0-1/2-3/4-5/6), ansiedade/
 * regulação 0-3 com rótulos, item de ideação que só ENCAMINHA (não pontua), e o
 * Mapa Bio³ ao vivo. Coleta respostas por código (casam com a fiação de import).
 *
 * USO INTERNO / TESTE. O item de ideação exibe recursos de apoio e NÃO gradua
 * risco; o score emocional é interno. Antes de paciente real: travas de compliance.
 */

import { useMemo, useState, type ReactNode } from "react";
import { UNIFIED_FORM, type UnifiedQuestion, type UnifiedBlock } from "@/modules/neuro-id/unified-form-template";
import { bio3FromAnswerRows, type AnswerRow } from "@/modules/neuro-id/unified-form-result";
import { PILLAR_LABELS, type NeuroPillar } from "@/modules/neuro-id/catalog";

const FREQ = ["Nunca", "Poucos dias", "Mais da metade dos dias", "Quase todos os dias"];
const IMP = ["Não atrapalha", "Atrapalha um pouco", "Atrapalha bastante", "Atrapalha muito"];
const PILLAR_ORDER: NeuroPillar[] = ["fisico", "bioquimico", "emocional"];

type AnswerMap = Record<string, number | string>;

function bandColor(v: number): string {
  if (v <= 30) return "bg-emerald-600";
  if (v <= 69) return "bg-amber-500";
  return "bg-rose-600";
}

export default function NeuroIdUnifiedForm({
  onComplete,
}: {
  onComplete?: (answers: AnswerMap) => void;
}) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const set = (code: string, value: number | string) => setAnswers((a) => ({ ...a, [code]: value }));

  // Bio³ ao vivo: converte respostas numéricas em linhas por código.
  const outcome = useMemo(() => {
    const rows: AnswerRow[] = Object.entries(answers)
      .filter(([, v]) => typeof v === "number")
      .map(([code, v]) => ({ code, value: v as number }));
    return bio3FromAnswerRows(rows);
  }, [answers]);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-4 lg:grid-cols-[1fr_320px]">
      <main className="flex flex-col gap-4">
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-3 text-xs text-neutral-600 shadow-sm dark:bg-neutral-900 dark:text-neutral-400">
          {UNIFIED_FORM.disclaimer}
        </div>
        {UNIFIED_FORM.blocks.map((b) => (
          <BlockView key={b.key} block={b} answers={answers} set={set} />
        ))}
        <button
          type="button"
          onClick={() => onComplete?.(answers)}
          className="mt-2 self-start rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
        >
          Concluir
        </button>
      </main>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">Mapa Bio³ ao vivo</h3>
          <div className="flex flex-col items-center gap-1.5">
            {PILLAR_ORDER.map((p, i) => {
              const v = outcome.neuro.pillars[p].dysfunction;
              const width = [58, 78, 100][i];
              return (
                <div
                  key={p}
                  style={{ width: `${width}%` }}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-xs text-white ${
                    v === null ? "bg-neutral-200 !text-neutral-400 dark:bg-neutral-800" : bandColor(v)
                  }`}
                >
                  <span>{PILLAR_LABELS[p]}</span>
                  <span className="font-mono tabular-nums">{v === null ? "—" : `${Math.round(v)}%`}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800">
            <span className="text-xs text-neutral-500">Índice geral</span>
            <span className="font-mono text-xl tabular-nums">
              {outcome.neuro.indiceGeral === null ? "—" : `${Math.round(outcome.neuro.indiceGeral)}%`}
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-neutral-500">Segurança (fora do score)</h3>
          <SafetyRow ok={!outcome.safety.cardioresp} okText="Sem sinal cardiorrespiratório" warnText="Precaução cardiorrespiratória" />
          <SafetyRow ok={!outcome.safety.crisis} okText="Sem sinal de encaminhamento" warnText="Encaminhamento de apoio ativado (988/188)" crit />
        </div>
      </aside>
    </div>
  );
}

function SafetyRow({ ok, okText, warnText, crit }: { ok: boolean; okText: string; warnText: string; crit?: boolean }) {
  const color = ok ? "bg-emerald-500" : crit ? "bg-rose-600" : "bg-amber-500";
  const bg = ok ? "bg-emerald-50 dark:bg-emerald-950/30" : crit ? "bg-rose-50 dark:bg-rose-950/30" : "bg-amber-50 dark:bg-amber-950/30";
  return (
    <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${bg}`}>
      <span className={`mt-1 h-2 w-2 flex-none rounded-full ${color}`} />
      <span>{ok ? okText : warnText}</span>
    </div>
  );
}

function BlockView({ block, answers, set }: { block: UnifiedBlock; answers: AnswerMap; set: (c: string, v: number | string) => void }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-1 flex items-baseline gap-2.5">
        <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-teal-700 font-mono text-xs text-white">{block.key}</span>
        <h2 className="text-lg font-semibold">{block.title}</h2>
      </div>
      {block.intro && <p className="mb-2 text-sm text-neutral-500">{block.intro}</p>}
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {block.questions.map((q) =>
          q.type === "info" ? (
            <p key={q.code} className="pt-4 text-sm text-neutral-500">{q.label}</p>
          ) : (
            <QuestionView key={q.code} q={q} answers={answers} set={set} />
          ),
        )}
      </div>
    </section>
  );
}

function QuestionView({ q, answers, set }: { q: UnifiedQuestion; answers: AnswerMap; set: (c: string, v: number | string) => void }) {
  return (
    <div className="py-3.5">
      <div className="mb-2 text-sm font-medium">{q.label}</div>
      <QuestionInput q={q} answers={answers} set={set} />
    </div>
  );
}

function OptButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-[38px] rounded-lg border px-3 py-1.5 text-left text-[13px] transition ${
        active
          ? "border-teal-700 bg-teal-700 text-white"
          : "border-neutral-300 bg-neutral-50 hover:border-teal-600 dark:border-neutral-700 dark:bg-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}

function QuestionInput({ q, answers, set }: { q: UnifiedQuestion; answers: AnswerMap; set: (c: string, v: number | string) => void }) {
  const max = q.max ?? 3;

  if (q.type === "freqimp") {
    const freq = answers[`${q.code}_freq`];
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wide text-neutral-500">Com que frequência</span>
          <div className="flex flex-wrap gap-1.5">
            {FREQ.map((lb, v) => (
              <OptButton key={v} active={freq === v} onClick={() => set(`${q.code}_freq`, v)}>{v} · {lb}</OptButton>
            ))}
          </div>
        </div>
        {typeof freq === "number" && freq >= 1 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-neutral-500">O quanto atrapalha</span>
            <div className="flex flex-wrap gap-1.5">
              {IMP.map((lb, v) => (
                <OptButton key={v} active={answers[`${q.code}_imp`] === v} onClick={() => set(`${q.code}_imp`, v)}>{v} · {lb}</OptButton>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (q.type === "scale" && q.anchors) {
    return <RangeButtons q={q} max={max} value={answers[q.code]} onPick={(v) => set(q.code, v)} />;
  }
  if (q.type === "scale") {
    const labels = q.scaleLabels;
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: max + 1 }, (_, v) => (
          <OptButton key={v} active={answers[q.code] === v} onClick={() => set(q.code, v)}>
            {labels && labels[v] != null ? `${v} · ${labels[v]}` : v}
          </OptButton>
        ))}
      </div>
    );
  }

  if (q.type === "crisis") {
    const v = answers[q.code];
    return (
      <div className="flex flex-col gap-2">
        <RangeButtons q={q} max={q.max ?? 6} value={v} onPick={(nv) => set(q.code, nv)} />
        {typeof v === "number" && v >= 3 && (
          <div className="rounded-xl border border-rose-500 bg-rose-50 p-3 text-[13px] dark:bg-rose-950/30">
            <b className="text-rose-700 dark:text-rose-300">Você não está sozinho.</b> O que você sente importa. Se estiver pensando em se machucar, fale com alguém agora.
            <div className="mt-1.5 flex flex-wrap gap-3 font-mono text-xs">
              <span>EUA · 988</span><span>Brasil · 188 (CVV)</span><span>Emergência · 911 / 192</span>
            </div>
            <div className="mt-1.5 text-[11px] text-neutral-500">Este item não gera nota. Encaminhamento para apoio, sem avaliação de risco pela clínica.</div>
          </div>
        )}
      </div>
    );
  }

  if (q.type === "yes_no") {
    return (
      <div className="flex gap-1.5">
        {["Não", "Sim"].map((lb, v) => (
          <OptButton key={v} active={answers[q.code] === v} onClick={() => set(q.code, v)}>{lb}</OptButton>
        ))}
      </div>
    );
  }
  if (q.type === "choice" || q.type === "multi") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {(q.options ?? []).map((o) => (
          <OptButton key={o} active={answers[q.code] === o} onClick={() => set(q.code, o)}>{o}</OptButton>
        ))}
      </div>
    );
  }
  // text / date
  return (
    <input
      type={q.type === "date" ? "date" : "text"}
      value={typeof answers[q.code] === "string" ? (answers[q.code] as string) : ""}
      onChange={(e) => set(q.code, e.target.value)}
      placeholder={q.type === "text" ? "Escreva aqui…" : ""}
      className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"
    />
  );
}

/** Botões de FAIXA para escalas com âncoras (0-1, 2-3, 4-5, 6…) — cada um rotulado. */
function RangeButtons({ q, max, value, onPick }: { q: UnifiedQuestion; max: number; value: number | string | undefined; onPick: (v: number) => void }) {
  const anchors = q.anchors ?? {};
  const ks = Object.keys(anchors).map(Number).sort((a, b) => a - b);
  return (
    <div className="flex flex-wrap gap-1.5">
      {ks.map((k, idx) => {
        const next = idx < ks.length - 1 ? ks[idx + 1] : max + 1;
        const end = next - 1;
        const rng = k >= end ? `${k}` : `${k}-${end}`;
        return (
          <OptButton key={k} active={value === k} onClick={() => onPick(k)}>{rng} · {anchors[k]}</OptButton>
        );
      })}
    </div>
  );
}
