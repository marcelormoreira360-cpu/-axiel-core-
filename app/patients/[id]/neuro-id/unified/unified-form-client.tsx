"use client";

import { useState } from "react";
import NeuroIdUnifiedForm from "@/components/neuroid-unified-form";
import { submitUnifiedFormAction } from "../actions";

export default function UnifiedFormClient({ patientId }: { patientId: string }) {
  const [saved, setSaved] = useState<{ assessmentId: string; crisis: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (saved) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-sm dark:border-emerald-800 dark:bg-emerald-950/30">
        Mapa Bio³ salvo como rascunho interno.
        {saved.crisis && " Um sinal de encaminhamento de apoio foi registrado para revisão humana."}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mx-auto mb-2 max-w-2xl rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30">{error}</div>
      )}
      <NeuroIdUnifiedForm
        onComplete={async (answers) => {
          if (saving) return;
          setSaving(true);
          setError(null);
          try {
            const r = await submitUnifiedFormAction(patientId, answers);
            setSaved({ assessmentId: r.assessmentId, crisis: r.crisis });
          } catch (e) {
            setError(e instanceof Error ? e.message : "Falha ao salvar.");
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
