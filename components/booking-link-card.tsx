"use client";

import { useState } from "react";

interface BookingLinkCardProps {
  slug: string;
  baseUrl: string;
}

export function BookingLinkCard({ slug, baseUrl }: BookingLinkCardProps) {
  const url = `${baseUrl}/book/${slug}`;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="bg-[#0F6E56]/[.07] border border-[#0F6E56]/20 rounded-[14px] px-[18px] py-[16px] mb-[24px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#0F6E56] mb-[6px]">
            Link de Agendamento Online
          </p>
          <p className="text-[13px] text-[#0F1A2E]/70 mb-[10px]">
            Envie este link para seus pacientes agendarem diretamente, sem precisar ligar.
          </p>
          <div className="flex items-center gap-2 bg-white border border-black/[.08] rounded-[8px] px-[12px] py-[8px]">
            <span className="text-[12px] text-[#0F1A2E] font-mono truncate flex-1 select-all">
              {url}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-[8px] mt-[12px]">
        <button
          onClick={handleCopy}
          className={`flex items-center gap-[6px] text-[12px] font-medium px-[14px] py-[7px] rounded-[8px] border transition
            ${copied
              ? "bg-[#0F6E56] text-white border-[#0F6E56]"
              : "bg-white text-[#0F6E56] border-[#0F6E56]/30 hover:bg-[#0F6E56]/[.08]"
            }`}
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2 7L5 10L11 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Copiado!
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M1 9V2a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Copiar link
            </>
          )}
        </button>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-[6px] text-[12px] font-medium px-[14px] py-[7px] rounded-[8px] border bg-white text-[#0F1A2E]/60 border-black/[.1] hover:bg-black/[.04] transition"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M8 1h3m0 0v3m0-3L5.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Visualizar
        </a>

        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Agende sua consulta aqui: ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-[6px] text-[12px] font-medium px-[14px] py-[7px] rounded-[8px] border bg-white text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/[.06] transition"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4.5 5s0-1 1-1 1.5 1 1.5 1-.5 1-1 1.5-1 1.5 0 2.5 2.5 1.5 3 1 1-1 1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Enviar via WhatsApp
        </a>
      </div>
    </div>
  );
}
