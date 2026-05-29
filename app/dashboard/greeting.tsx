"use client";

import { useState, useEffect } from "react";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardGreeting({ name }: { name: string }) {
  // Initialize with empty string to avoid server/client timezone mismatch (React #418).
  // getGreeting() on the server uses UTC; on the client uses the local timezone.
  // useEffect only runs on the client, so the greeting is set correctly after hydration.
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    setGreeting(getGreeting());
    const id = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">
      {greeting}{name ? `, ${name}` : ""}.
    </h1>
  );
}
