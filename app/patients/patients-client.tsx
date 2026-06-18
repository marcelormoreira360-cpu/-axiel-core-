"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Patient } from "@/lib/types";
import type { PatientJourneyStage, ClinicalJourneyStage, JourneyStageTone } from "@/modules/patient-journey/stage";

const JOURNEY_STAGES: ClinicalJourneyStage[] = [
  "novo", "avaliacao_agendada", "avaliado", "plano_sugerido",
  "em_tratamento", "reavaliacao", "manutencao", "inativo", "reativacao",
];

const JOURNEY_TONE_CLASSES: Record<JourneyStageTone, string> = {
  neutral:   "bg-[#F4F3EF] text-[#6B6A66]",
  active:    "bg-[#E1F5EE] text-[#085041]",
  attention: "bg-[#FFF8E7] text-[#633806]",
  risk:      "bg-[#FEE2E2] text-[#991B1B]",
};

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function statusClasses(status: string) {
  if (status === "active") return "bg-[#E1F5EE] text-[#085041]";
  if (status === "archived") return "bg-[#F4F3EF] text-[#A09E98]";
  return "bg-[#FAEEDA] text-[#633806]";
}

function statusKey(status: string): "active" | "inactive" | "archived" {
  if (status === "active") return "active";
  if (status === "archived") return "archived";
  return "inactive";
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
type Practitioner = { id: string; name: string };

const STATUS_TAB_KEYS: StatusFilter[] = ["all", "active", "inactive", "archived"];

export function PatientsClient({
  patients,
  practitionerMode,
  recentPatientIds = [],
  page = 1,
  totalPages = 1,
  totalCount,
  initialSearch,
  practitioners,
  journeyByPatientId = {},
}: {
  patients: Patient[];
  practitionerMode: boolean;
  recentPatientIds?: string[];
  page?: number;
  totalPages?: number;
  totalCount?: number;
  initialSearch?: string;
  practitioners?: Practitioner[];
  journeyByPatientId?: Record<string, PatientJourneyStage>;
}) {
  const t = useTranslations("patients.list");
  const tJourney = useTranslations("patientPanels.intelligenceStrip.journey");
  const locale = useLocale();
  const router = useRouter();
  // When initialSearch is set, we're showing server-filtered results.
  // Local query state is used for client-side filtering within the loaded page.
  const [query, setQuery] = useState(initialSearch ?? "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [practitionerFilter, setPractitionerFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<ClinicalJourneyStage | "all">("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce URL navigation so server search fires after typing stops (~400ms)
  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams();
        if (value.trim()) params.set("q", value.trim());
        router.push(`/patients${params.toString() ? `?${params.toString()}` : ""}`);
      }, 400);
    },
    [router],
  );

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
    const hasFilter = q || statusFilter !== "all" || practitionerFilter !== "all" || stageFilter !== "all";
    const source = hasFilter ? patients : sortedPatients;
    return source.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (stageFilter !== "all" && journeyByPatientId[p.id]?.stage !== stageFilter) return false;
      if (practitionerFilter !== "all") {
        const appts = p.appointments ?? [];
        const hasAppt = appts.some((a) => a.practitioner_id === practitionerFilter);
        if (!hasAppt) return false;
      }
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [patients, sortedPatients, query, statusFilter, practitionerFilter, stageFilter, journeyByPatientId]);

  const totalLabel = practitionerMode
    ? t("countPractitioner", { count: patients.length })
    : t("countClinic", { count: patients.length });

  return (
    <>
      {/* Topbar */}
      <div className="flex items-start justify-between mb-[16px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">{totalLabel}</p>
        </div>
        <div className="flex items-center gap-[8px]">
          {practitioners && practitioners.length > 1 && (
            <select
              value={practitionerFilter}
              onChange={(e) => setPractitionerFilter(e.target.value)}
              className="h-7 rounded-lg border border-black/[.08] bg-[#F4F3EF] px-2 text-[11px] text-[#6B6A66] font-medium"
            >
              <option value="all">{t("allPractitioners")}</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <a
            href="/api/patients/export"
            download
            className="flex items-center gap-1.5 text-[12px] font-medium text-black/60 border border-black/[.10] hover:bg-black/[.04] rounded-xl px-3 py-1.5 transition"
          >
            <Download className="w-[13px] h-[13px]" />
            {t("exportCsv")}
          </a>
          <Link
            href="/patients/new"
            className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-lg border border-black/[.12]"
          >
            {t("newPatient")}
          </Link>
        </div>
      </div>

      {/* Search + filter bar */}
      {patients.length > 0 && (
        <div className="mb-[14px] space-y-[10px]">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[14px] w-[14px] text-[#A09E98] pointer-events-none" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-[32px] pr-[10px] py-[8px] text-[13px] bg-white border border-black/[.09] rounded-lg outline-none focus:ring-2 focus:ring-[#0F6E56]/20 focus:border-[#0F6E56] placeholder:text-[#C4C2BA] text-[#0F1A2E] transition"
            />
            {query && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#A09E98] hover:text-[#0F1A2E] transition text-[13px] leading-none"
                aria-label={t("clearSearch")}
              >
                ✕
              </button>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-[6px] flex-wrap">
            {STATUS_TAB_KEYS.map((tabKey) => {
              const count =
                tabKey === "all"
                  ? patients.length
                  : patients.filter((p) => p.status === tabKey).length;
              const active = statusFilter === tabKey;
              return (
                <button
                  key={tabKey}
                  onClick={() => setStatusFilter(tabKey)}
                  className={[
                    "inline-flex items-center gap-[5px] px-[10px] py-[4px] rounded-full text-[11px] font-medium transition",
                    active
                      ? "bg-[#0F6E56] text-white"
                      : "bg-white border border-black/[.09] text-[#6B6966] hover:border-[#0F6E56]/40 hover:text-[#0F6E56]",
                  ].join(" ")}
                >
                  {t(`tabs.${tabKey}`)}
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

          {/* Journey stage filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as ClinicalJourneyStage | "all")}
            className="h-7 rounded-lg border border-black/[.08] bg-[#F4F3EF] px-2 text-[11px] text-[#6B6A66] font-medium"
          >
            <option value="all">{tJourney("label")}: {t("allStages")}</option>
            {JOURNEY_STAGES.map((s) => (
              <option key={s} value={s}>{tJourney(`stage.${s}`)}</option>
            ))}
          </select>
        </div>
      )}

      {/* List */}
      {patients.length === 0 ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[15px] py-[40px] text-center">
          <p className="text-[13px] text-[#A09E98]">{t("emptyTitle")}</p>
          <Link
            href="/patients/new"
            className="mt-3 inline-flex text-[12px] font-medium text-[#0F6E56] hover:underline"
          >
            {t("registerFirst")}
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[15px] py-[40px] text-center">
          <p className="text-[13px] text-[#A09E98]">
            {query
              ? t("noResultsSearch", { query })
              : t("noResultsFilter")}
          </p>
          <button
            onClick={() => { handleSearchChange(""); setStatusFilter("all"); setPractitionerFilter("all"); setStageFilter("all"); }}
            className="mt-2 text-[12px] text-[#0F6E56] hover:underline"
          >
            {t("clearFilters")}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
          {filtered.map((patient, i) => {
            const av = avatarColor(patient.full_name);
            const journey = journeyByPatientId[patient.id];
            const since = new Date(patient.created_at).toLocaleDateString(locale, {
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
                    {patient.email ?? t("noEmail")}
                    {patient.phone ? ` · ${patient.phone}` : ""}
                    {` · ${t("since", { date: since })}`}
                  </p>
                </div>

                {/* Recent badge */}
                {recentPatientIds.indexOf(patient.id) < 5 && (
                  <span className="text-[10px] px-2 py-[2px] rounded-full shrink-0 bg-[#E6F1FB] text-[#0C447C]">
                    {t("recent")}
                  </span>
                )}

                {/* Journey stage badge */}
                {journey && (
                  <span className={`hidden sm:inline text-[10px] px-2 py-[2px] rounded-full shrink-0 ${JOURNEY_TONE_CLASSES[journey.tone]}`}>
                    {tJourney(`stage.${journey.stage}`)}
                  </span>
                )}

                {/* Status badge */}
                <span className={`text-[10px] px-2 py-[2px] rounded-full shrink-0 ${statusClasses(patient.status)}`}>
                  {t(`status.${statusKey(patient.status)}`)}
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
      {(query || statusFilter !== "all" || practitionerFilter !== "all" || stageFilter !== "all") && filtered.length > 0 && (
        <p className="mt-[10px] text-[11px] text-[#A09E98] text-center">
          {t("resultCount", { filtered: filtered.length, total: patients.length })}
        </p>
      )}

      {/* Pagination — only shown when no local-only filter and there are multiple pages */}
      {statusFilter === "all" && stageFilter === "all" && totalPages > 1 && (
        <div className="flex items-center justify-between mt-[14px] pt-[12px] border-t border-black/[.06]">
          <p className="text-[11px] text-[#A09E98]">
            {t("pageOf", { page, total: totalPages })}
            {totalCount !== undefined && t("totalSuffix", { count: totalCount })}
          </p>
          <div className="flex items-center gap-[6px]">
            {page > 1 ? (
              <Link
                href={`?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page - 1) }).toString()}`}
                className="flex items-center gap-[4px] px-[10px] h-[28px] rounded-[7px] border border-black/[.1] text-[11px] text-[#6B6A66] hover:bg-[#F4F3EF] transition"
              >
                <ChevronLeft className="w-[12px] h-[12px]" />
                {t("prev")}
              </Link>
            ) : (
              <span className="flex items-center gap-[4px] px-[10px] h-[28px] rounded-[7px] border border-black/[.05] text-[11px] text-[#D3D1C7] cursor-not-allowed">
                <ChevronLeft className="w-[12px] h-[12px]" />
                {t("prev")}
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={`?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page + 1) }).toString()}`}
                className="flex items-center gap-[4px] px-[10px] h-[28px] rounded-[7px] border border-black/[.1] text-[11px] text-[#6B6A66] hover:bg-[#F4F3EF] transition"
              >
                {t("next")}
                <ChevronRight className="w-[12px] h-[12px]" />
              </Link>
            ) : (
              <span className="flex items-center gap-[4px] px-[10px] h-[28px] rounded-[7px] border border-black/[.05] text-[11px] text-[#D3D1C7] cursor-not-allowed">
                {t("next")}
                <ChevronRight className="w-[12px] h-[12px]" />
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
