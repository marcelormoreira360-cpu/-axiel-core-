"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronUp, Trash2, FlaskConical, X } from "lucide-react";
import type { PatientExam } from "@/services/exams-service";
import { addExamAction, deleteExamAction } from "@/app/patients/[id]/exams/actions";

type ResultDraft = {
  biomarker: string;
  value: string;
  unit: string;
  ref_min: string;
  ref_max: string;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "high") return <span className="text-[10px] font-medium px-[7px] py-[2px] rounded-full bg-red-50 text-red-500">Alto</span>;
  if (status === "low") return <span className="text-[10px] font-medium px-[7px] py-[2px] rounded-full bg-amber-50 text-amber-600">Baixo</span>;
  if (status === "normal") return <span className="text-[10px] font-medium px-[7px] py-[2px] rounded-full bg-[#E1F5EE] text-[#085041]">Normal</span>;
  return <span className="text-[10px] font-medium px-[7px] py-[2px] rounded-full bg-[#F4F3EF] text-[#A09E98]">—</span>;
}

function ExamCard({ exam, patientId }: { exam: PatientExam; patientId: string }) {
  const [open, setOpen] = useState(false);
  const outOfRange = exam.exam_results.filter((r) => r.status === "high" || r.status === "low").length;

  const formatted = new Date(exam.exam_date + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-[14px] py-[12px] hover:bg-[#FAFAF8] transition text-left"
      >
        <div className="flex items-center gap-[10px]">
          <div className="w-8 h-8 rounded-[8px] bg-[#F4F3EF] flex items-center justify-center shrink-0">
            <FlaskConical className="h-3.5 w-3.5 text-[#A09E98]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[#0F1A2E]">{formatted}</p>
            <p className="text-[11px] text-[#A09E98]">
              {exam.lab_name ?? "Laboratório"} · {exam.exam_results.length} marcadores
              {outOfRange > 0 && (
                <span className="ml-[6px] text-red-500 font-medium">{outOfRange} fora do padrão</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-[8px]">
          <form action={deleteExamAction.bind(null, exam.id, patientId)}>
            <button
              type="submit"
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-6 flex items-center justify-center rounded text-[#D3D1C7] hover:text-red-400 transition"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </form>
          {open ? <ChevronUp className="h-3.5 w-3.5 text-[#A09E98]" /> : <ChevronDown className="h-3.5 w-3.5 text-[#A09E98]" />}
        </div>
      </button>

      {open && exam.exam_results.length > 0 && (
        <div className="border-t border-black/[.05]">
          <div className="divide-y divide-black/[.04]">
            {[...exam.exam_results]
              .sort((a, b) => {
                const order = { high: 0, low: 1, unknown: 2, normal: 3 };
                return (order[a.status] ?? 2) - (order[b.status] ?? 2);
              })
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between px-[14px] py-[9px] gap-[8px]">
                  <p className="text-[12px] text-[#0F1A2E] flex-1">{r.biomarker}</p>
                  <span className="text-[12px] font-medium text-[#0F1A2E]">
                    {r.value} <span className="text-[#A09E98] font-normal">{r.unit}</span>
                  </span>
                  {(r.ref_min != null || r.ref_max != null) && (
                    <span className="text-[10px] text-[#A09E98]">
                      ref: {r.ref_min ?? "?"}–{r.ref_max ?? "?"} {r.unit}
                    </span>
                  )}
                  <StatusBadge status={r.status} />
                </div>
              ))}
          </div>
          {exam.notes && (
            <div className="px-[14px] py-[10px] bg-[#FAFAF8] border-t border-black/[.04]">
              <p className="text-[11px] text-[#6B6A66]">{exam.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddExamForm({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const [results, setResults] = useState<ResultDraft[]>([
    { biomarker: "", value: "", unit: "", ref_min: "", ref_max: "" },
  ]);

  function addRow() {
    setResults((r) => [...r, { biomarker: "", value: "", unit: "", ref_min: "", ref_max: "" }]);
  }

  function removeRow(i: number) {
    setResults((r) => r.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, field: keyof ResultDraft, val: string) {
    setResults((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }

  async function submit(formData: FormData) {
    const parsed = results
      .filter((r) => r.biomarker.trim() && r.value.trim())
      .map((r) => ({
        biomarker: r.biomarker.trim(),
        value: parseFloat(r.value),
        unit: r.unit.trim() || undefined,
        ref_min: r.ref_min.trim() ? parseFloat(r.ref_min) : null,
        ref_max: r.ref_max.trim() ? parseFloat(r.ref_max) : null,
      }));
    formData.set("results", JSON.stringify(parsed));
    await addExamAction(formData);
    onClose();
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      <div className="flex items-center justify-between px-[14px] py-[12px] bg-[#FAFAF8] border-b border-black/[.06]">
        <p className="text-[12px] font-medium text-[#0F1A2E]">Novo exame</p>
        <button type="button" onClick={onClose} className="text-[#A09E98] hover:text-[#0F1A2E]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form action={submit} className="px-[14px] py-[14px] space-y-[12px]">
        <input type="hidden" name="patient_id" value={patientId} />

        <div className="grid grid-cols-2 gap-[8px]">
          <div>
            <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">Data do exame</label>
            <input
              type="date"
              name="exam_date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">Laboratório</label>
            <input
              type="text"
              name="lab_name"
              placeholder="Ex: Fleury, Sabin..."
              className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
        </div>

        {/* Biomarkers */}
        <div>
          <p className="text-[10px] font-medium text-[#6B6A66] mb-[6px]">Marcadores</p>
          <div className="space-y-[6px]">
            {/* Header */}
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_20px] gap-[4px] px-[2px]">
              {["Biomarcador", "Valor", "Unidade", "Ref. mín", "Ref. máx", ""].map((h) => (
                <p key={h} className="text-[9px] font-medium text-[#A09E98] uppercase tracking-[.06em]">{h}</p>
              ))}
            </div>
            {results.map((row, i) => (
              <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_20px] gap-[4px] items-center">
                <input
                  value={row.biomarker}
                  onChange={(e) => updateRow(i, "biomarker", e.target.value)}
                  placeholder="Ex: TSH"
                  className="px-[8px] py-[6px] rounded-[6px] border border-black/[.10] text-[11px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56]"
                />
                <input
                  value={row.value}
                  onChange={(e) => updateRow(i, "value", e.target.value)}
                  type="number"
                  step="any"
                  placeholder="0.0"
                  className="px-[8px] py-[6px] rounded-[6px] border border-black/[.10] text-[11px] text-center outline-none focus:border-[#0F6E56]"
                />
                <input
                  value={row.unit}
                  onChange={(e) => updateRow(i, "unit", e.target.value)}
                  placeholder="mUI/L"
                  className="px-[8px] py-[6px] rounded-[6px] border border-black/[.10] text-[11px] text-center outline-none focus:border-[#0F6E56]"
                />
                <input
                  value={row.ref_min}
                  onChange={(e) => updateRow(i, "ref_min", e.target.value)}
                  type="number"
                  step="any"
                  placeholder="—"
                  className="px-[8px] py-[6px] rounded-[6px] border border-black/[.10] text-[11px] text-center outline-none focus:border-[#0F6E56]"
                />
                <input
                  value={row.ref_max}
                  onChange={(e) => updateRow(i, "ref_max", e.target.value)}
                  type="number"
                  step="any"
                  placeholder="—"
                  className="px-[8px] py-[6px] rounded-[6px] border border-black/[.10] text-[11px] text-center outline-none focus:border-[#0F6E56]"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={results.length === 1}
                  className="text-[#D3D1C7] hover:text-red-400 disabled:opacity-0 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addRow}
            className="mt-[8px] flex items-center gap-[4px] text-[11px] text-[#0F6E56] hover:text-[#085041] transition"
          >
            <Plus className="h-3 w-3" /> Adicionar marcador
          </button>
        </div>

        <div>
          <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">Observações (opcional)</label>
          <input
            type="text"
            name="notes"
            placeholder="Contexto clínico relevante..."
            className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[16px] py-[8px] transition"
          >
            Salvar exame
          </button>
        </div>
      </form>
    </div>
  );
}

export function PatientExamsPanel({ exams, patientId }: { exams: PatientExam[]; patientId: string }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-[8px]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#6B6A66]">
          Exames laboratoriais · {exams.length}
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition"
          >
            <Plus className="h-3 w-3" /> Novo exame
          </button>
        )}
      </div>

      {adding && <AddExamForm patientId={patientId} onClose={() => setAdding(false)} />}

      {exams.length === 0 && !adding ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[12px]">
          <p className="text-[12px] text-[#D3D1C7]">Nenhum exame registrado ainda.</p>
        </div>
      ) : (
        exams.map((exam) => (
          <ExamCard key={exam.id} exam={exam} patientId={patientId} />
        ))
      )}
    </div>
  );
}
