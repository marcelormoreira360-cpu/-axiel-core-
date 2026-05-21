"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, User, CalendarDays, Users, ArrowRight } from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */
type PatientResult = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
};

type AppointmentResult = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  patient_id: string | null;
  patient_name: string;
  session_type_name: string | null;
};

type LeadResult = {
  id: string;
  full_name: string;
  email: string | null;
  stage: string;
};

type SearchResults = {
  patients: PatientResult[];
  appointments: AppointmentResult[];
  leads: LeadResult[];
};

/* ── Helpers ────────────────────────────────────────────── */
const OPEN_EVENT = "axiel:search";

export function openGlobalSearch() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

function ptDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const stageLabel: Record<string, string> = {
  new_lead: "Novo",
  contacted: "Contactado",
  scheduled: "Agendado",
  converted_to_patient: "Convertido",
};

type NavItem = { href: string };

function flatItems(results: SearchResults): NavItem[] {
  const items: NavItem[] = [];
  results.patients.forEach((p) => items.push({ href: `/patients/${p.id}` }));
  results.appointments.forEach((a) =>
    items.push({ href: a.patient_id ? `/patients/${a.patient_id}` : `/schedule` })
  );
  results.leads.forEach((l) => items.push({ href: `/leads/${l.id}` }));
  return items;
}

/* ── Sidebar trigger button (separate export) ────────────── */
export function SearchTriggerButton() {
  return (
    <button
      onClick={openGlobalSearch}
      className="w-full flex items-center gap-[8px] px-[10px] py-[7px] rounded-[8px] bg-white/60 dark:bg-white/[.05] border border-black/[.08] dark:border-white/[.07] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-white dark:hover:bg-white/[.08] transition text-[12px]"
      aria-label="Abrir busca global"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left truncate">Buscar…</span>
      <kbd className="hidden lg:inline-flex items-center text-[9px] font-medium bg-black/[.06] dark:bg-white/[.08] text-[#A09E98] rounded-[4px] px-[5px] py-[2px] leading-none">
        ⌘K
      </kbd>
    </button>
  );
}

/* ── Modal (single global instance) ────────────────────── */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Cmd+K and custom event */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    }
    function onOpen() { setOpen(true); }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  /* Focus when opens; reset when closes */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(null);
      setActiveIdx(0);
    }
  }, [open]);

  /* Debounced search */
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data: SearchResults = await res.json();
        setResults(data);
        setActiveIdx(0);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    search(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!results) return;
    const items = flatItems(results);
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIdx];
      if (item) { router.push(item.href); setOpen(false); }
    }
  }

  const total = results
    ? results.patients.length + results.appointments.length + results.leads.length
    : 0;

  if (!open) return null;

  let globalIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[99] flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Panel */}
      <div
        className="relative w-full max-w-[560px] bg-white dark:bg-[#161B26] rounded-[16px] shadow-2xl border border-black/[.08] dark:border-white/[.08] overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Input row */}
        <div className="flex items-center gap-[10px] px-[16px] py-[14px] border-b border-black/[.06] dark:border-white/[.06]">
          <Search className="h-[18px] w-[18px] shrink-0 text-[#A09E98]" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInput}
            placeholder="Buscar pacientes, sessões, leads…"
            className="flex-1 bg-transparent text-[15px] text-[#0F1A2E] dark:text-[#E8E6E2] placeholder:text-[#C5C3BC] dark:placeholder:text-[#6B6A66] outline-none"
          />
          {loading && (
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#0F6E56] border-t-transparent" />
          )}
          <button
            onClick={() => setOpen(false)}
            className="shrink-0 text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {!results && !loading && (
            <div className="px-[16px] py-[32px] text-center">
              <p className="text-[13px] text-[#A09E98]">
                {query.length === 0
                  ? "Digite para buscar pacientes, sessões ou leads."
                  : "Continue digitando…"}
              </p>
            </div>
          )}

          {results && total === 0 && (
            <div className="px-[16px] py-[32px] text-center">
              <p className="text-[13px] text-[#A09E98]">
                Nenhum resultado para{" "}
                <span className="font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">"{query}"</span>
              </p>
            </div>
          )}

          {/* Patients */}
          {results && results.patients.length > 0 && (
            <section>
              <p className="px-[16px] pt-[12px] pb-[4px] text-[10px] font-semibold uppercase tracking-[.1em] text-[#A09E98]">
                Pacientes
              </p>
              {results.patients.map((p) => {
                const idx = globalIdx++;
                const active = idx === activeIdx;
                return (
                  <button
                    key={p.id}
                    onClick={() => { router.push(`/patients/${p.id}`); setOpen(false); }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full flex items-center gap-[12px] px-[16px] py-[10px] transition text-left ${
                      active ? "bg-[#F4F3EF] dark:bg-white/[.06]" : "hover:bg-[#FAFAF8] dark:hover:bg-white/[.03]"
                    }`}
                  >
                    <div className="w-8 h-8 shrink-0 rounded-full bg-[#E1F5EE] flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-[#0F6E56]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] truncate">{p.full_name}</p>
                      <p className="text-[11px] text-[#A09E98] truncate">{p.email ?? p.phone ?? "—"}</p>
                    </div>
                    <span className={`text-[10px] px-[7px] py-[2px] rounded-full shrink-0 ${
                      p.status === "active" ? "bg-[#E1F5EE] text-[#085041]" : "bg-[#F4F3EF] text-[#A09E98]"
                    }`}>
                      {p.status === "active" ? "Ativo" : p.status === "inactive" ? "Inativo" : "Arquivado"}
                    </span>
                    {active && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#A09E98]" />}
                  </button>
                );
              })}
            </section>
          )}

          {/* Appointments */}
          {results && results.appointments.length > 0 && (
            <section>
              <p className="px-[16px] pt-[12px] pb-[4px] text-[10px] font-semibold uppercase tracking-[.1em] text-[#A09E98]">
                Sessões
              </p>
              {results.appointments.map((a) => {
                const idx = globalIdx++;
                const active = idx === activeIdx;
                const href = a.patient_id ? `/patients/${a.patient_id}` : `/schedule`;
                return (
                  <button
                    key={a.id}
                    onClick={() => { router.push(href); setOpen(false); }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full flex items-center gap-[12px] px-[16px] py-[10px] transition text-left ${
                      active ? "bg-[#F4F3EF] dark:bg-white/[.06]" : "hover:bg-[#FAFAF8] dark:hover:bg-white/[.03]"
                    }`}
                  >
                    <div className="w-8 h-8 shrink-0 rounded-full bg-[#EEF2FF] flex items-center justify-center">
                      <CalendarDays className="h-3.5 w-3.5 text-[#4F46E5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] truncate">
                        {a.patient_name}
                      </p>
                      <p className="text-[11px] text-[#A09E98] truncate">
                        {ptDateTime(a.starts_at)}
                        {a.session_type_name ? ` · ${a.session_type_name}` : ""}
                        {` · ${a.duration_minutes} min`}
                      </p>
                    </div>
                    {active && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#A09E98]" />}
                  </button>
                );
              })}
            </section>
          )}

          {/* Leads */}
          {results && results.leads.length > 0 && (
            <section>
              <p className="px-[16px] pt-[12px] pb-[4px] text-[10px] font-semibold uppercase tracking-[.1em] text-[#A09E98]">
                Leads
              </p>
              {results.leads.map((l) => {
                const idx = globalIdx++;
                const active = idx === activeIdx;
                return (
                  <button
                    key={l.id}
                    onClick={() => { router.push(`/leads/${l.id}`); setOpen(false); }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full flex items-center gap-[12px] px-[16px] py-[10px] transition text-left ${
                      active ? "bg-[#F4F3EF] dark:bg-white/[.06]" : "hover:bg-[#FAFAF8] dark:hover:bg-white/[.03]"
                    }`}
                  >
                    <div className="w-8 h-8 shrink-0 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                      <Users className="h-3.5 w-3.5 text-[#D97706]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] truncate">{l.full_name}</p>
                      <p className="text-[11px] text-[#A09E98] truncate">{l.email ?? "—"}</p>
                    </div>
                    <span className="text-[10px] px-[7px] py-[2px] rounded-full shrink-0 bg-[#FEF3C7] text-[#92400E]">
                      {stageLabel[l.stage] ?? l.stage}
                    </span>
                    {active && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#A09E98]" />}
                  </button>
                );
              })}
            </section>
          )}

          {results && total > 0 && <div className="h-[8px]" />}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-[12px] px-[16px] py-[8px] border-t border-black/[.05] dark:border-white/[.05] bg-[#FAFAF8] dark:bg-[#0E1117]">
          <span className="flex items-center gap-[4px] text-[10px] text-[#C5C3BC]">
            <kbd className="bg-black/[.06] dark:bg-white/[.08] rounded-[3px] px-[4px] py-[1px] text-[9px]">↑↓</kbd>
            navegar
          </span>
          <span className="flex items-center gap-[4px] text-[10px] text-[#C5C3BC]">
            <kbd className="bg-black/[.06] dark:bg-white/[.08] rounded-[3px] px-[4px] py-[1px] text-[9px]">↵</kbd>
            abrir
          </span>
          <span className="flex items-center gap-[4px] text-[10px] text-[#C5C3BC]">
            <kbd className="bg-black/[.06] dark:bg-white/[.08] rounded-[3px] px-[4px] py-[1px] text-[9px]">Esc</kbd>
            fechar
          </span>
        </div>
      </div>
    </div>
  );
}
