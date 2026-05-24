"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updatePractitionerAction } from "./actions";

export interface PractitionerRow {
  user_id: string;
  display_name: string | null;
  specialty: string | null;
  bio: string | null;
  is_bookable: boolean;
  full_name: string | null;
  email: string | null;
}

interface Props {
  practitioners: PractitionerRow[];
}

export function PractitionersList({ practitioners }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, {
    display_name: string;
    specialty: string;
    bio: string;
    is_bookable: boolean;
  }>>({});
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function startEdit(p: PractitionerRow) {
    setEditingId(p.user_id);
    setFormState((prev) => ({
      ...prev,
      [p.user_id]: {
        display_name: p.display_name ?? p.full_name ?? "",
        specialty: p.specialty ?? "",
        bio: p.bio ?? "",
        is_bookable: p.is_bookable,
      },
    }));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function save(userId: string) {
    const form = formState[userId];
    if (!form) return;
    startTransition(async () => {
      const result = await updatePractitionerAction(userId, {
        display_name: form.display_name || undefined,
        specialty: form.specialty || undefined,
        bio: form.bio || undefined,
        is_bookable: form.is_bookable,
      });
      if (result.error) {
        setErrors((prev) => ({ ...prev, [userId]: result.error! }));
      } else {
        setErrors((prev) => { const n = { ...prev }; delete n[userId]; return n; });
        setEditingId(null);
      }
    });
  }

  if (practitioners.length === 0) {
    return (
      <div className="bg-white border border-black/[.07] rounded-[12px] p-8 text-center space-y-3">
        <p className="text-[14px] font-medium text-[#0F1A2E]">Nenhum profissional ainda</p>
        <p className="text-[13px] text-[#A09E98] max-w-sm mx-auto leading-relaxed">
          Convide os membros da equipe pelo e-mail. Após aceitarem o convite, eles aparecem aqui para configuração do perfil público.
        </p>
        <Link
          href="/settings/equipe"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[16px] py-[8px] rounded-lg mt-2"
        >
          + Convidar profissional
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {practitioners.map((p) => {
        const isEditing = editingId === p.user_id;
        const form = formState[p.user_id];
        const displayLabel = p.display_name ?? p.full_name ?? "Profissional";

        return (
          <div key={p.user_id} className="bg-white border border-black/[.07] rounded-[12px] px-5 py-4">
            {!isEditing ? (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium text-[#0F1A2E] truncate">{displayLabel}</p>
                    {p.is_bookable && (
                      <span className="text-[10px] font-medium text-[#0F6E56] bg-[#E1F5EE] px-[7px] py-[2px] rounded-full shrink-0">
                        Agenda pública
                      </span>
                    )}
                  </div>
                  {p.specialty && <p className="text-[12px] text-[#A09E98] mt-[2px]">{p.specialty}</p>}
                  {p.email && <p className="text-[11px] text-[#A09E98] mt-[1px]">{p.email}</p>}
                </div>
                <button
                  onClick={() => startEdit(p)}
                  className="shrink-0 text-[12px] font-medium text-[#0F6E56] hover:text-[#085041] transition px-3 py-1.5 border border-[#0F6E56]/30 rounded-[7px] hover:bg-[#F0FAF6]"
                >
                  Editar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-[#A09E98] uppercase tracking-[.1em]">Editar perfil público</p>
                <div>
                  <label className="text-[11px] font-medium text-[#6B6A66] mb-1 block">Nome de exibição</label>
                  <input
                    value={form?.display_name ?? ""}
                    onChange={(e) => setFormState((prev) => ({ ...prev, [p.user_id]: { ...prev[p.user_id], display_name: e.target.value } }))}
                    placeholder={p.full_name ?? "Nome público"}
                    className="w-full px-3 py-2 rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6B6A66] mb-1 block">Especialidade</label>
                  <input
                    value={form?.specialty ?? ""}
                    onChange={(e) => setFormState((prev) => ({ ...prev, [p.user_id]: { ...prev[p.user_id], specialty: e.target.value } }))}
                    placeholder="Ex: Acupuntura, Nutrição Funcional…"
                    className="w-full px-3 py-2 rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#6B6A66] mb-1 block">Bio</label>
                  <textarea
                    value={form?.bio ?? ""}
                    onChange={(e) => setFormState((prev) => ({ ...prev, [p.user_id]: { ...prev[p.user_id], bio: e.target.value } }))}
                    rows={3}
                    placeholder="Breve apresentação que aparece no agendamento público."
                    className="w-full px-3 py-2 rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition resize-none"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form?.is_bookable ?? false}
                    onChange={(e) => setFormState((prev) => ({ ...prev, [p.user_id]: { ...prev[p.user_id], is_bookable: e.target.checked } }))}
                    className="accent-[#0F6E56] w-4 h-4"
                  />
                  <span className="text-[12px] text-[#0F1A2E]">Aparece na agenda pública (agendamento online)</span>
                </label>
                {errors[p.user_id] && <p className="text-[11px] text-red-500">{errors[p.user_id]}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => save(p.user_id)}
                    disabled={isPending}
                    className="flex-1 bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 text-white text-[12px] font-medium rounded-[8px] py-2 transition"
                  >
                    {isPending ? "Salvando…" : "Salvar"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={isPending}
                    className="flex-1 border border-black/[.10] text-[#6B6A66] hover:bg-black/[.03] text-[12px] font-medium rounded-[8px] py-2 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
