"use client";

import { useTheme } from "@/components/theme-provider";

export function DarkModeToggle() {
  const { resolved, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
      aria-label={resolved === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
      className="flex items-center justify-center w-7 h-7 rounded-lg text-[#A09E98] dark:text-[#6B6A66] hover:bg-black/[.06] dark:hover:bg-white/[.08] transition"
    >
      {resolved === "dark" ? (
        // Sun icon
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M7.5 1v1.5M7.5 12.5V14M14 7.5h-1.5M2.5 7.5H1M12.07 2.93l-1.06 1.06M4 11l-1.06 1.06M12.07 12.07l-1.06-1.06M4 4l-1.06-1.06" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      ) : (
        // Moon icon
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M12.5 8.5A5.5 5.5 0 015.5 1.5a5.5 5.5 0 100 11 5.5 5.5 0 007-4z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}
