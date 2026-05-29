"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

// Safe localStorage wrappers — Safari throws SecurityError in Private Browsing
// and certain sandboxed contexts. Never let this crash the app.
function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* silent */ }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = (lsGet("axiel-theme") as Theme) ?? "system";
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  function applyTheme(t: Theme) {
    try {
      const isDark =
        t === "dark" ||
        (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
      setResolved(isDark ? "dark" : "light");
    } catch { /* silent — sandboxed env */ }
  }

  function setTheme(t: Theme) {
    lsSet("axiel-theme", t);
    setThemeState(t);
    applyTheme(t);
  }

  // Listen for system preference changes when theme is "system"
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => { if (theme === "system") applyTheme("system"); };
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } catch { return undefined; }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
