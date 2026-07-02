"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link2, Search, X, Copy, Check } from "lucide-react";
import { createInvitationAction } from "@/app/forms/[id]/invite/actions";

interface Patient {
  id: string;
  full_name: string;
  email: string | null;
}

interface Props {
  templateId: string;
  templateName: string;
  patients: Patient[];
}

export function ShareFormButton({ templateId, templateName, patients }: Props) {
  const t = useTranslations("forms.share");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim().length > 0
    ? patients.filter((p) =>
        p.full_name.toLowerCase().includes(query.toLowerCase()) ||
        (p.email ?? "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : patients.slice(0, 6);

  function handleOpen() {
    setOpen(true);
    setQuery("");
    setGeneratedUrl(null);
    setCopied(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleClose() {
    setOpen(false);
    setQuery("");
    setGeneratedUrl(null);
    setCopied(false);
  }

  function handleSelectPatient(patientId: string) {
    startTransition(async () => {
      const { url } = await createInvitationAction(templateId, patientId);
      setGeneratedUrl(url);
    });
  }

  function handleCopy() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title={t("sendTitle")}
        className="flex items-center gap-[5px] text-[11px] text-[#6B6A66] border border-black/[.08] hover:bg-[#F4F3EF] rounded-[6px] px-[10px] py-[5px] transition"
      >
        <Link2 className="h-3 w-3" /> {t("send")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <button
            type="button"
            aria-label={t("close")}
            onClick={handleClose}
            className="absolute inset-0 bg-[#0F1A2E]/30 backdrop-blur-[2px]"
          />

          <div className="relative w-full max-w-[400px] bg-white rounded-[16px] border border-black/[.08] shadow-xl p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#A09E98]">{t("generateLink")}</p>
                <h2 className="text-[15px] font-medium text-[#0F1A2E] mt-[2px] leading-tight">{templateName}</h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label={t("close")}
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {!generatedUrl ? (
              <>
                <p className="text-[11px] text-[#A09E98] mb-3">{t("selectPatient")}</p>

                {/* Search */}
                <div className="relative mb-2">
                  <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[13px] w-[13px] text-[#A09E98] pointer-events-none" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("searchPlaceholder")}
                    autoComplete="off"
                    className="w-full pl-[30px] pr-3 py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
                  />
                </div>

                {/* Patient list */}
                <div className="max-h-[220px] overflow-y-auto rounded-[8px] border border-black/[.07] divide-y divide-black/[.04]">
                  {filtered.length === 0 ? (
                    <p className="text-[12px] text-[#A09E98] px-[12px] py-[10px]">{t("noPatients")}</p>
                  ) : (
                    filtered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSelectPatient(p.id)}
                        className="w-full text-left px-[12px] py-[9px] hover:bg-[#F4F3EF] transition flex items-center gap-[8px] disabled:opacity-50"
                      >
                        <div className="w-6 h-6 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[9px] font-medium text-[#0F6E56] shrink-0">
                          {p.full_name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[12px] font-medium text-[#0F1A2E]">{p.full_name}</p>
                          {p.email && <p className="text-[10px] text-[#A09E98]">{p.email}</p>}
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {isPending && (
                  <p className="text-[11px] text-[#A09E98] mt-2 text-center">{t("generating")}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-[11px] text-[#A09E98] mb-3">{t("linkGenerated")}</p>
                <div className="flex items-center gap-[6px] bg-[#F4F3EF] rounded-[8px] px-[10px] py-[8px]">
                  <p className="text-[11px] text-[#0F1A2E] flex-1 truncate font-mono">{generatedUrl}</p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 flex items-center gap-[4px] text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[6px] px-[8px] py-[4px] transition"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? t("copied") : t("copy")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setGeneratedUrl(null); setQuery(""); }}
                  className="mt-3 text-[11px] text-[#A09E98] hover:text-[#0F1A2E] transition"
                >
                  {t("selectOther")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
