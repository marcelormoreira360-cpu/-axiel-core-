"use client";

import { useState, useTransition } from "react";

interface ClinicEditFormProps {
  id: string;
  name: string;
  slug: string;
  updateAction: (formData: FormData) => Promise<void>;
}

export function ClinicEditForm({ id, name, slug, updateAction }: ClinicEditFormProps) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [savedSlug, setSavedSlug] = useState(slug);
  const [savedName, setSavedName] = useState(name);
  const [slugValue, setSlugValue] = useState(slug);
  const [nameValue, setNameValue] = useState(name);
  const [success, setSuccess] = useState(false);

  function handleSlugInput(val: string) {
    // auto-format: lowercase, replace spaces/special chars with hyphens
    setSlugValue(val.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"));
  }

  function handleCancel() {
    setSlugValue(savedSlug);
    setNameValue(savedName);
    setEditing(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateAction(fd);
      setSavedSlug(slugValue);
      setSavedName(nameValue);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[#0F1A2E]">{savedName}</p>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            /{savedSlug} · link de agendamento: <span className="font-mono">/book/{savedSlug}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {success && (
            <span className="text-[11px] text-[#0F6E56] font-medium">Salvo ✓</span>
          )}
          <button
            onClick={() => setEditing(true)}
            className="text-[12px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 px-[12px] py-[6px] rounded-[8px] hover:bg-[#0F6E56]/[.07] transition"
          >
            Editar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-[10px]">
      <input type="hidden" name="id" value={id} />

      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[4px]">
          Nome da clínica
        </label>
        <input
          name="name"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          required
          className="w-full text-[13px] text-[#0F1A2E] border border-black/[.12] rounded-[8px] px-[12px] py-[8px] outline-none focus:border-[#0F6E56] transition"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#A09E98] mb-[4px]">
          Slug (aparece na URL de agendamento)
        </label>
        <div className="flex items-center border border-black/[.12] rounded-[8px] overflow-hidden focus-within:border-[#0F6E56] transition">
          <span className="text-[12px] text-[#A09E98] px-[10px] bg-black/[.03] border-r border-black/[.08] py-[8px] select-none">
            /book/
          </span>
          <input
            name="slug"
            value={slugValue}
            onChange={(e) => handleSlugInput(e.target.value)}
            required
            placeholder="minha-clinica"
            className="flex-1 text-[13px] text-[#0F1A2E] px-[10px] py-[8px] outline-none bg-transparent"
          />
        </div>
        <p className="text-[11px] text-[#A09E98] mt-[4px]">
          Use apenas letras minúsculas, números e hífens. Ex: <span className="font-mono">clinica-axiel</span>
        </p>
      </div>

      <div className="flex gap-[8px] pt-[2px]">
        <button
          type="submit"
          disabled={isPending}
          className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-60 px-[14px] py-[7px] rounded-[8px] transition"
        >
          {isPending ? "Salvando…" : "Salvar"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="text-[12px] font-medium text-[#0F1A2E]/60 border border-black/[.1] px-[14px] py-[7px] rounded-[8px] hover:bg-black/[.04] transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
