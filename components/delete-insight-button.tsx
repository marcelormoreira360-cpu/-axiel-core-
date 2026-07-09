"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { archiveAiInsightAction } from "@/app/patients/[id]/insights/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * Excluir (arquivar) um relatório/caso de IA. Arquiva: some da ficha e das
 * listas, mas é reversível (não apaga registro clínico). Pede confirmação
 * antes, via ConfirmDialog do app.
 */
export function DeleteInsightButton({ patientId, insightId }: { patientId: string; insightId: string }) {
  const t = useTranslations("insights.deleteButton");
  const tActions = useTranslations("common.actions");
  const [open, setOpen] = useState(false);
  const action = archiveAiInsightAction.bind(null, patientId, insightId);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl px-4 py-3 text-xs font-medium text-red-600/80 transition hover:bg-red-50 hover:text-red-600"
      >
        <span className="inline-flex items-center gap-2">
          <Trash2 className="h-3.5 w-3.5" /> {tActions("delete")}
        </span>
      </button>
      <ConfirmDialog
        open={open}
        description={t("confirm")}
        confirmLabel={tActions("delete")}
        destructive
        onConfirm={async () => { await action(); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
