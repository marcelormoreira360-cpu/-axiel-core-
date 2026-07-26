"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type ContactState = { ok: boolean } | null;

/**
 * Envolve o formulário de contato da clínica (server action passada por prop)
 * apenas para dar FEEDBACK visível ao salvar. Sem isto o form salvava em
 * silêncio e parecia que "não salvou". Os campos continuam sendo renderizados
 * no servidor e chegam como children.
 */
export function ClinicContactForm({
  action,
  children,
  className,
}: {
  action: (prev: ContactState, formData: FormData) => Promise<ContactState>;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("clinics.contact");
  const [state, formAction] = useActionState(action, null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (state?.ok) toast.success(t("saved"));
  }, [state, t]);

  return (
    <form action={formAction} className={className}>
      {children}
    </form>
  );
}
