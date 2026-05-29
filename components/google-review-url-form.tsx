"use client";

import { useState, useActionState } from "react";
import { saveGoogleReviewUrlAction } from "@/app/settings/integrations/actions";
import { ExternalLink } from "lucide-react";

type State = { ok: boolean; error: string | null } | null;

async function wrappedAction(_prev: State, formData: FormData): Promise<State> {
  return saveGoogleReviewUrlAction(formData);
}

export function GoogleReviewUrlForm({ current }: { current: string | null }) {
  const [state, action, pending] = useActionState<State, FormData>(wrappedAction, null);
  const [value, setValue] = useState(current ?? "");

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="google_review_url" value={value} />
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://g.page/r/xxxx/review"
          className="flex-1 h-9 px-3 rounded-[8px] border border-black/[.08] dark:border-white/[.1] bg-white dark:bg-[#1C2333] text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] placeholder:text-[#A09E98] focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/30"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-9 px-4 rounded-[8px] bg-[#0F6E56] text-white text-[13px] font-medium hover:bg-[#085041] transition disabled:opacity-50 shrink-0"
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>

      {value && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-[#0F6E56] hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Testar link
        </a>
      )}

      {state?.ok && (
        <p className="text-[11px] text-[#0F6E56]">Link salvo com sucesso.</p>
      )}
      {state?.error && (
        <p className="text-[11px] text-red-500">{state.error}</p>
      )}

      <p className="text-[11px] text-[#A09E98]">
        Cole o link de avaliação do Google (encontre em Google Meu Negócio → Obter link para avaliação).
        Pacientes com nota ≥ 4 receberão este link pelo WhatsApp automaticamente.
      </p>
    </form>
  );
}
