"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Patient } from "@/lib/types";

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function statusBadge(status: string) {
  if (status === "active") return { label: "Ativo", classes: "bg-[#E1F5EE] text-[#085041]" };
  if (status === "archived") return { label: "Arquivado", classes: "bg-[#F4F3EF] text-[#A09E98]" };
  return { label: "Inativo", classes: "bg-[#FAEEDA] text-[#633806]" };
}

function avatarColor(name: string) {
  const colors = [
    { bg: "#E1F5EE", text: "#0F6E56" },
    { bg: "#E6F1FB", text: "#0C447C" },
    { bg: "#FAEEDA", text: "#633806" },
    { bg: "#F0E8FB", text: "#5C2D91" },
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

type StatusFilter = "all" | "active" | "inactive" | "archived";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativos" },
  { key: "inactive", label: "Inativos" },
  { key: "archived", label: "Arquivados" },
];

export function PatientsClient({
  patients,
  practitionerMode,
  recentPatientIds = [],
  page = 1,
  totalPages = 1,
  totalCount,
}: {
  patients: Patient[];
  practitionerMode: boolean;
  recentPatientIds?: string[];
  page?: number;
  totalPages?: number;
  totalCount?: number;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // When no search/filter active: recently-scheduled patients float to top
  const sortedPatients = useMemo(() => {
    if (recentPatientIds.length === 0) return patients;
    const rankMap = new Map(recentPatientIds.map((id, i) => [id, i]));
    return [...patients].sort((a, b) => {
      const ra = rankMap.has(a.id) ? rankMap.get(a.id)! : Infinity;
      const rb = rankMap.has(b.id) ? rankMap.get(b.id)! : Infinity;
      if (ra !== rb) return ra - rb;
      // Patients without appointments: maintain original order (by created_at desc)
      return 0;
    });
  }, [patients, recentPatientIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // When a search/filter is active, use the original (created_at desc) order
    const source = q || statusFilter !== "all" ? patients : sortedPatients;
    return source.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [patients, sortedPatients, query, statusFilter]);

  const totalLabel =
    patients.length > 0
      ? `${patients.length} paciente${patients.length !== 1 ? "s" : ""}${practitionerMode ? " atendidos por você" : " na clínica"}`
      : "Nenhum paciente ainda";

  return (
    <>
      {/* Topbar */}
      <div className="flex items-start justify-between mb-[16px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Pacientes</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">{totalLabel}</p>
        </div>
        <Link
          href="/patients/new"
          className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-lg border border-black/[.12]"
        >
          + Novo paciente
        </Link>
      </div>

      {/* Search + filter bar */}
      {patients.length > 0 && (
        <div className="mb-[14px] space-y-[10px]">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-[#A09E98] pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou telefone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-[32px] pr-[10px] py-[8px] text-[13px] bg-white border border-black/[.09] rounded-lg outline-none focus:ring-2 focus:ring-[#0F6E56]/20 focus:border-[#0F6E56] placeholder:text-[#C4C2BA] text-[#0F1A2E] transition"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#A09E98] hover:text-[#0F1A2E] transition text-[13px] leading-none"
                aria-label="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-[6px] flex-wrap">
            {STATUS_TABS.map((tab) => {
              const count =
                tab.key === "all"
                  ? patients.length
                  : patients.filter((p) => p.status === tab.key).length;
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={[
                    "inline-flex items-center gap-[5px] px-[10px] py-[4px] rounded-full text-[11px] font-medium transition",
                    active
                      ? "bg-[#0F6E56] text-white"
                      : "bg-white border border-black/[.09] text-[#6B6966] hover:border-[#0F6E56]/40 hover:text-[#0F6E56]",
                  ].join(" ")}
                >
                  {tab.label}
                  <span
                    className={[
                      "px-[5px] py-[1px] rounded-full text-[10px]",
                      active ? "bg-white/20 text-white" : "bg-black/[.06] text-[#6B6966]",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      {patients.length === 0 ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[15px] py-[40px] text-center">
          <p className="text-[13px] text-[#A09E98]">Nenhum paciente cadastrado ainda.</p>
          <Link
            href="/patients/new"
            className="mt-3 inline-flex text-[12px] font-medium text-[#0F6E56] hover:underline"
          >
            Cadastrar primeiro paciente →
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[15px] py-[40px] text-center">
          <p className="text-[13px] text-[#A09E98]">
            {query
              ? `Nenhum paciente encontrado para "${query}".`
              : "Nenhum paciente com esse filtro."}
          </p>
          <button
            onClick={() => { setQuery(""); setStatusFilter("all"); }}
            className="mt-2 text-[12px] text-[#0F6E56] hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
          {filtered.map((patient, i) => {
            const av = avatarColor(patient.full_name);
            const badge = statusBadge(patient.status);
            const since = new Date(patient.created_at).toLocaleDateString("pt-BR", {
              month: "short",
              year: "numeric",
            });

            return (
              <Link
                key={patient.id}
                href={`/patients/${patient.id}`}
                className={[
                  "flex items-center gap-[12px] px-[15px] py-[12px] hover:bg-[#F4F3EF] transition group",
                  i !== filtered.length - 1 ? "border-b border-black/[.05]" : "",
                ].join(" ")}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-medium shrink-0"
                  style={{ background: av.bg, color: av.text }}
                >
                  {initials(patient.full_name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{patient.full_name}</p>
                  <p className="text-[11px] text-[#A09E98] mt-[1px]">
                    {patient.email ?? "Sem e-mail"}
                    {patient.phone ? ` · ${patient.phone}` : ""}
                    {` · Desde ${since}`}
                  </p>
                </div>

                {/* Recent badge */}
                {recentPatientIds.indexOf(patient.id) < 5 && (
                  <span className="text-[10px] px-2 py-[2px] rounded-full shrink-0 bg-[#E6F1FB] text-[#0C447C]">
                    Recente
                  </span>
                )}

                {/* Status badge */}
                <span className={`text-[10px] px-2 py-[2px] rounded-full shrink-0 ${badge.classes}`}>
                  {badge.label}
                </span>

                {/* Arrow */}
                <svg
                  className="w-3.5 h-3.5 text-[#D3D1C7] group-hover:text-[#0F6E56] transition shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}

      {/* Result count when searching */}
      {(query || statusFilter !== "all") && filtered.length > 0 && (
        <p className="mt-[10px] text-[11px] text-[#A09E98] text-center">
          {filtered.length} de {patients.length} paciente{patients.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Pagination — only shown when no active search/filter and there are multiple pages */}
      {!query && statusFilter === "all" && totalPages > 1 && (
        <div className="flex items-center justify-between mt-[14px] pt-[12px] border-t border-black/[.06]">
          <p className="text-[11px] text-[#A09E98]">
            Página {page} de {totalPages}
            {totalCount !== undefined && ` · ${totalCount} pacientes`}
          </p>
          <div className="flex items-center gap-[6px]">
            {page > 1 ? (
              <Link
                href={`?page=${page - 1}`}
                className="flex items-center gap-[4px] px-[10px] h-[28px] rounded-[7px] border border-black/[.1] text-[11px] text-[#6B6A66] hover:bg-[#F4F3EF] transition"
              >
                <ChevronLeft className="w-[12px] h-[12px]" />
                Anterior
              </Link>
            ) : (
              <span className="flex items-center gap-[4px] px-[10px] h-[28px] rounded-[7px] border border-black/[.05] text-[11px] text-[#D3D1C7] cursor-not-allowed">
                <ChevronLeft className="w-[12px] h-[12px]" />
                Anterior
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={`?page=${page + 1}`}
                className="flex items-center gap-[4px] px-[10px] h-[28px] rounded-[7px] border border-black/[.1] text-[11px] text-[#6B6A66] hover:bg-[#F4F3EF] transition"
              >
                Próxima
                <ChevronRight className="w-[12px] h-[12px]" />
              </Link>
            ) : (
              <span className="flex items-center gap-[4px] px-[10px] h-[28px] rounded-[7px] border border-black/[.05] text-[11px] text-[#D3D1C7] cursor-not-allowed">
                Próxima
                <ChevronRight className="w-[12px] h-[12px]" />
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
