"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

type State = "idle" | "loading" | "success" | "error";

export function ResultsSendReportButton() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (state === "loading") return;
    setState("loading");
    setMessage(null);

    try {
      const res = await fetch("/api/results/send-report", { method: "POST" });
      const body = (await res.json()) as { ok: boolean; email?: string; error?: string };

      if (body.ok) {
        setState("success");
        setMessage("Relatório enviado! Verifique seu email.");
      } else {
        setState("error");
        setMessage(body.error ?? "Erro ao enviar relatório.");
      }
    } catch {
      setState("error");
      setMessage("Erro ao enviar relatório.");
    }

    setTimeout(() => {
      setState("idle");
      setMessage(null);
    }, 4000);
  }

  const isLoading = state === "loading";
  const isSuccess = state === "success";
  const isError = state === "error";

  return (
    <div className="flex items-center gap-[6px]">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={[
          "flex items-center gap-[5px] px-[10px] py-[6px] rounded-[8px] text-[12px] font-medium transition",
          "border border-black/[.09]",
          isLoading
            ? "opacity-60 cursor-not-allowed bg-white text-[#6B6A66]"
            : isSuccess
            ? "bg-[#F0FAF5] border-[#9FE1CB] text-[#0F6E56]"
            : isError
            ? "bg-[#FEF2F2] border-red-200 text-red-600"
            : "bg-white text-[#6B6A66] hover:bg-[#F4F3EF]",
        ].join(" ")}
      >
        <Mail
          size={13}
          className={isLoading ? "animate-pulse" : ""}
        />
        {isLoading
          ? "Enviando…"
          : isSuccess || isError
          ? (message ?? "Enviar relatório por email")
          : "Enviar relatório por email"}
      </button>
    </div>
  );
}
