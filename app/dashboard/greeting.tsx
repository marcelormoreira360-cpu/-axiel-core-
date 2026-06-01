"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

type Period = "morning" | "afternoon" | "evening";

function getPeriod(): Period {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export function DashboardGreeting({ name }: { name: string }) {
  const t = useTranslations("dashboard.greeting");
  // Inicializa vazio para evitar mismatch de timezone servidor/cliente (React #418).
  // getPeriod() no servidor usa UTC; no cliente usa o fuso local. useEffect só roda
  // no cliente, então a saudação é definida corretamente após a hidratação.
  const [period, setPeriod] = useState<Period | "">("");

  useEffect(() => {
    setPeriod(getPeriod());
    const id = setInterval(() => setPeriod(getPeriod()), 60_000);
    return () => clearInterval(id);
  }, []);

  const text =
    period === ""
      ? ""
      : name
        ? t("withName", { greeting: t(period), name })
        : t("noName", { greeting: t(period) });

  return (
    <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
      {text}
      {period === "" ? "" : "."}
    </h1>
  );
}
