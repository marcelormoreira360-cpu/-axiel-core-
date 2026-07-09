"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/confirm-dialog";

function TriggerButton({ onOpen }: { onOpen: () => void }) {
  const { pending } = useFormStatus();
  const t = useTranslations("leads");

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-axiel-blue px-6 py-4 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-axiel-blueDark disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
    >
      <UserCheck className="h-4 w-4" />
      {pending ? t("convert.converting") : t("convert.button")}
    </button>
  );
}

export function ConvertLeadButton({
  leadId,
  action,
}: {
  leadId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const t = useTranslations("leads");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="lead_id" value={leadId} />
      <TriggerButton onOpen={() => setConfirmOpen(true)} />
      <ConfirmDialog
        open={confirmOpen}
        description={t("convert.confirmDescription")}
        confirmLabel={t("convert.button")}
        onConfirm={() => formRef.current?.requestSubmit()}
        onClose={() => setConfirmOpen(false)}
      />
    </form>
  );
}
