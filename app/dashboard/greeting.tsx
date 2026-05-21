"use client";

import { useState, useEffect } from "react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardGreeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState(getGreeting());

  // Re-evaluate every minute so a tab left open eventually updates
  useEffect(() => {
    const id = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
      {greeting}{name ? `, ${name}` : ""}.
    </h1>
  );
}
