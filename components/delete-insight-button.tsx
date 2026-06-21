"use client";

import { Trash2 } from "lucide-react";
import { archiveAiInsightAction } from "@/app/patients/[id]/insights/actions";

/**
 * Excluir (arquivar) um relatório/caso de IA. Arquiva — some da ficha e das listas,
 * mas é reversível (não apaga registro clínico). Pede confirmação antes.
 */
export function DeleteInsightButton({ patientId, insightId }: { patientId: string; insightId: string }) {
  const action = archiveAiInsightAction.bind(null, patientId, insightId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Excluir este relatório/caso? Ele sai da ficha para você gerar um novo. (Reversível.)")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-xl px-4 py-3 text-xs font-medium text-red-600/80 transition hover:bg-red-50 hover:text-red-600"
      >
        <span className="inline-flex items-center gap-2">
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </span>
      </button>
    </form>
  );
}
