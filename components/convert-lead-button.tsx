"use client";

import { useFormStatus } from "react-dom";
import { UserCheck } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-axiel-blue px-6 py-4 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-axiel-blueDark disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
    >
      <UserCheck className="h-4 w-4" />
      {pending ? "Converting..." : "Convert to Patient"}
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
  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm("Are you sure you want to convert this lead into a patient?");
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="lead_id" value={leadId} />
      <SubmitButton />
    </form>
  );
}
