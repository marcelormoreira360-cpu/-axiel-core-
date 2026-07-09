"use client";

// Botão de anonimização (LGPD) com confirmação via ConfirmDialog do app.
// Precisa ser Client Component porque usa onClick/estado; a página de editar
// paciente é Server Component e não pode receber event handlers diretamente.

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function AnonymizePatientButton({
  action,
  confirmMsg,
  label,
}: {
  action: () => Promise<void>;
  confirmMsg: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 text-[12px] font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 bg-white hover:bg-red-50 dark:hover:bg-red-500/10 rounded-[8px] px-[14px] py-[7px] transition whitespace-nowrap"
      >
        {label}
      </button>
      <ConfirmDialog
        open={open}
        description={confirmMsg}
        confirmLabel={label}
        destructive
        onConfirm={async () => { await action(); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
