"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

interface ClinicEditFormProps {
  id: string;
  name: string;
  slug: string;
  updateAction: (formData: FormData) => Promise<{ error?: string }>;
}

export function ClinicEditForm({ id, name, slug, updateAction }: ClinicEditFormProps) {
  const t = useTranslations("clinics.editForm");
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [savedSlug, setSavedSlug] = useState(slug);
  const [savedName, setSavedName] = useState(name);
  const [slugValue, setSlugValue] = useState(slug);
  const [nameValue, setNameValue] = useState(name);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSlugInput(val: string) {
    // auto-format: lowercase, replace spaces/special chars with hyphens
    setSlugValue(val.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"));
  }

  function handleCancel() {
    setSlugValue(savedSlug);
    setNameValue(savedName);
    setError(null);
    setEditing(false);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await updateAction(fd);
      if (res?.error) { setError(res.error); return; }
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
            /{savedSlug} · {t("bookingLink")} <span className="font-mono">/book/{savedSlug}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {success && (
            <span className="text-[11px] text-[#0F6E56] font-medium">{t("saved")}</span>
          )}
          <button
            onClick={() => { setError(null); setEditing(true); }}
            className="text-[12px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 px-[12px] py-[6px] rounded-[8px] hover:bg-[#0F6E56]/[.07] transition"
          >
            {t("edit")}
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
          {t("clinicName")}
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
          {t("slugLabel")}
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
            placeholder={t("slugPlaceholder")}
            className="flex-1 text-[13px] text-[#0F1A2E] px-[10px] py-[8px] outline-none bg-transparent"
          />
        </div>
        <p className="text-[11px] text-[#A09E98] mt-[4px]">
          {t("slugHint")} <span className="font-mono">clinica-axiel</span>
        </p>
      </div>

      {error && (
        <p role="alert" className="text-[12px] text-[#DC2626] bg-[#DC2626]/[.07] border border-[#DC2626]/20 rounded-[8px] px-[10px] py-[7px]">
          {error}
        </p>
      )}

      <div className="flex gap-[8px] pt-[2px]">
        <button
          type="submit"
          disabled={isPending}
          className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-60 px-[14px] py-[7px] rounded-[8px] transition"
        >
          {isPending ? t("saving") : t("save")}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="text-[12px] font-medium text-[#0F1A2E]/60 border border-black/[.1] px-[14px] py-[7px] rounded-[8px] hover:bg-black/[.04] transition"
        >
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
