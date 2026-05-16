"use client";

import { useRef, useState } from "react";
import { Search, X, Link2, Copy, Check, Send } from "lucide-react";
import type { Patient } from "@/lib/types";
import { createInvitationAction } from "@/app/forms/[id]/invite/actions";

export function FormInvitationPanel({
  patients,
  templateId,
}: {
  patients: Patient[];
  templateId: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered =
    query.trim().length > 0
      ? patients
          .filter(
            (p) =>
              p.full_name.toLowerCase().includes(query.toLowerCase()) ||
              (p.email ?? "").toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 6)
      : [];

  function pick(patient: Patient) {
    setSelected(patient);
    setQuery(patient.full_name);
    setGeneratedUrl(null);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setGeneratedUrl(null);
    inputRef.current?.focus();
  }

  async function generate() {
    if (!selected) return;
    setLoading(true);
    try {
      const result = await createInvitationAction(templateId, selected.id);
      setGeneratedUrl(result.url);
    } catch {
      // handle error silently — could add toast here
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-[10px]">
      {/* Patient search */}
      <div className="relative">
        <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[13px] w-[13px] text-[#A09E98] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (selected && e.target.value !== selected.full_name) {
              setSelected(null);
              setGeneratedUrl(null);
            }
          }}
          placeholder="Buscar paciente..."
          autoComplete="off"
          className="w-full pl-[30px] pr-3 py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
        />
      </div>

      {filtered.length > 0 && !selected && (
        <div className="bg-white border border-black/[.08] rounded-[8px] overflow-hidden shadow-sm">
          {filtered.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className={[
                "w-full text-left px-[12px] py-[9px] hover:bg-[#F4F3EF] transition flex items-center gap-[8px]",
                i !== filtered.length - 1 ? "border-b border-black/[.05]" : "",
              ].join(" ")}
            >
              <div className="w-6 h-6 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[9px] font-medium text-[#0F6E56] shrink-0">
                {p.full_name
                  .trim()
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <p className="text-[12px] font-medium text-[#0F1A2E]">{p.full_name}</p>
                {p.email && <p className="text-[10px] text-[#A09E98]">{p.email}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && !generatedUrl && (
        <div className="flex items-center gap-[8px] px-[10px] py-[7px] bg-[#E1F5EE] rounded-[8px]">
          <span className="text-[12px] text-[#085041] font-medium flex-1">{selected.full_name}</span>
          <button type="button" onClick={clear} className="text-[#A09E98] hover:text-[#0F1A2E] transition">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {!generatedUrl ? (
        <button
          type="button"
          onClick={generate}
          disabled={!selected || loading}
          className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-white bg-[#0F1A2E] hover:bg-[#1a2d4a] disabled:opacity-40 rounded-[8px] py-[9px] transition"
        >
          <Link2 className="h-3.5 w-3.5" />
          {loading ? "Gerando…" : "Gerar link"}
        </button>
      ) : (
        <div className="space-y-[8px]">
          <div className="flex items-center gap-[6px] px-[10px] py-[7px] bg-[#E1F5EE] rounded-[8px]">
            <span className="text-[12px] text-[#085041] font-medium flex-1 truncate">{selected?.full_name}</span>
          </div>
          <div className="bg-[#FAFAF8] border border-black/[.08] rounded-[8px] px-[10px] py-[8px]">
            <p className="text-[10px] text-[#A09E98] mb-[4px]">Link gerado (válido por 15 dias)</p>
            <p className="text-[11px] text-[#0F1A2E] break-all font-mono leading-relaxed">{generatedUrl}</p>
          </div>
          <div className="flex gap-[6px]">
            <button
              type="button"
              onClick={copy}
              className={[
                "flex-1 flex items-center justify-center gap-[5px] text-[12px] font-medium rounded-[8px] py-[8px] transition border",
                copied
                  ? "bg-[#E1F5EE] text-[#085041] border-[#0F6E56]/20"
                  : "bg-white text-[#0F1A2E] border-black/[.10] hover:bg-[#F4F3EF]",
              ].join(" ")}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Copiar link"}
            </button>
            {selected?.email && (
              <a
                href={`mailto:${selected.email}?subject=Questionário%20para%20preencher&body=Olá%2C%20${encodeURIComponent(selected.full_name)}!%0A%0APor%20favor%2C%20preencha%20o%20formulário%20clicando%20no%20link%20abaixo%3A%0A%0A${encodeURIComponent(generatedUrl)}`}
                className="flex items-center justify-center gap-[5px] text-[12px] font-medium bg-[#0F6E56] text-white rounded-[8px] px-[12px] py-[8px] hover:bg-[#085041] transition"
              >
                <Send className="h-3.5 w-3.5" /> E-mail
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setGeneratedUrl(null); clear(); }}
            className="w-full text-[11px] text-[#A09E98] hover:text-[#0F1A2E] transition"
          >
            Gerar para outro paciente
          </button>
        </div>
      )}
    </div>
  );
}
