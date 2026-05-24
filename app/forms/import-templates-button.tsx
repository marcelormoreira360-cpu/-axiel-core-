"use client";

import { useState, useTransition } from "react";
import { Download, X, Check, Loader2 } from "lucide-react";

interface Template {
  key: string;
  name: string;
  description: string;
  tag: string;
  action: () => Promise<void>;
}

interface Props {
  available: string[]; // keys not yet imported
}

// Keep in sync with actions.ts
export const TEMPLATE_CATALOG: Omit<Template, "action">[] = [
  { key: "phq9-pt", name: "PHQ-9 — Questionário sobre a Saúde do Paciente", description: "Rastreio de depressão, 9 itens, escala 0–3 (PT-BR)", tag: "Depressão" },
  { key: "phq9-en", name: "PHQ-9 — Patient Health Questionnaire", description: "Validated depression screening, 9 items, 0–3 scale (EN)", tag: "Depression" },
  { key: "gad7-pt", name: "GAD-7 — Transtorno de Ansiedade Generalizada (TAG)", description: "Rastreio de ansiedade, 7 itens, escala 0–3 (PT-BR)", tag: "Ansiedade" },
  { key: "gad7-en", name: "GAD-7 — Generalized Anxiety Disorder", description: "Validated anxiety screening, 7 items, 0–3 scale (EN)", tag: "Anxiety" },
  { key: "hpa-pt", name: "Eixo HPA — Questionário de Avaliação", description: "Disfunção hipotálamo-hipófise-adrenal, 3 seções (PT-BR)", tag: "HPA" },
  { key: "hpa-en", name: "HPA Axis — Assessment Questionnaire", description: "Hypothalamus-pituitary-adrenal dysfunction, 3 sections (EN)", tag: "HPA" },
  { key: "msq-en", name: "MSQ — Medical Symptoms Questionnaire", description: "15 body systems, 0–4 scale per symptom (EN)", tag: "MSQ" },
];

const TAG_COLORS: Record<string, string> = {
  "Depressão":  "bg-blue-50 text-blue-600",
  "Depression": "bg-blue-50 text-blue-600",
  "Ansiedade":  "bg-amber-50 text-amber-600",
  "Anxiety":    "bg-amber-50 text-amber-600",
  "HPA":        "bg-purple-50 text-purple-600",
  "MSQ":        "bg-teal-50 text-teal-600",
};

export function ImportTemplatesButton({
  available,
  actions,
}: {
  available: string[];
  actions: Record<string, () => Promise<void>>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (available.length === 0) return null;

  function handleImport(key: string, action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setDone((prev) => [...prev, key]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao importar");
      }
    });
  }

  const remaining = available.filter((k) => !done.includes(k));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[6px] px-[10px] py-[6px] transition"
      >
        <Download className="h-3 w-3" />
        Importar modelos ({remaining.length})
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#0F1A2E]/30 backdrop-blur-[2px]"
          />
          <div className="relative w-full max-w-[520px] bg-white rounded-[16px] border border-black/[.08] shadow-xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98]">Biblioteca de questionários</p>
                <h2 className="text-[16px] font-medium text-[#0F1A2E] mt-[2px]">Importar modelos validados</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-600">{error}</div>
            )}

            <div className="space-y-[6px]">
              {TEMPLATE_CATALOG.filter((t) => available.includes(t.key)).map((t) => {
                const isDone = done.includes(t.key);
                return (
                  <div
                    key={t.key}
                    className={`flex items-center gap-3 px-[12px] py-[10px] rounded-[10px] border transition ${
                      isDone
                        ? "border-[#0F6E56]/20 bg-[#F0FAF6]"
                        : "border-black/[.07] bg-white hover:border-black/[.12]"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[6px] mb-[2px]">
                        <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{t.name}</p>
                        <span className={`shrink-0 rounded-full px-[6px] py-[1px] text-[9px] font-semibold ${TAG_COLORS[t.tag] ?? "bg-[#F4F3EF] text-[#6B6A66]"}`}>
                          {t.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A09E98]">{t.description}</p>
                    </div>

                    {isDone ? (
                      <div className="shrink-0 flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56]">
                        <Check className="h-3.5 w-3.5" /> Importado
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleImport(t.key, actions[t.key])}
                        className="shrink-0 flex items-center gap-[4px] text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-50 rounded-[6px] px-[10px] py-[5px] transition"
                      >
                        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        Importar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {remaining.filter((k) => !done.includes(k)).length === 0 && (
              <p className="mt-4 text-center text-[12px] text-[#0F6E56] font-medium">
                ✓ Todos os modelos disponíveis foram importados!
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
