"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";

export function DeleteTemplateButton({
  action,
  templateName,
}: {
  action: () => Promise<void>;
  templateName: string;
}) {
  const t = useTranslations("forms.delete");
  return (
    <form
      action={async () => {
        if (!confirm(t("confirm", { name: templateName }))) return;
        await action();
      }}
    >
      <button
        type="submit"
        className="flex items-center gap-[5px] text-[11px] text-[#A09E98] border border-black/[.08] dark:border-white/[.08] hover:bg-red-50 hover:text-red-500 hover:border-red-200 rounded-[6px] px-[8px] py-[5px] transition"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </form>
  );
}
