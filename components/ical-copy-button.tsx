"use client";
import { useState } from "react";

export function IcalCopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex items-center gap-2 bg-[#F4F3EF] dark:bg-white/[.04] border border-black/[.08] dark:border-white/[.08] rounded-[8px] px-[12px] py-[8px]">
      <span className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] font-mono truncate flex-1 select-all">{url}</span>
      <button
        onClick={handleCopy}
        className={`shrink-0 text-[11px] font-medium px-[10px] py-[4px] rounded-[6px] transition ${copied ? "bg-[#0F6E56] text-white" : "bg-white dark:bg-white/[.08] text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#0F6E56]/[.08]"}`}
      >
        {copied ? "Copiado ✓" : "Copiar"}
      </button>
    </div>
  );
}
