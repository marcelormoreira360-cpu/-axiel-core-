"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, TrendingUp, Users, Star, BarChart3, ChevronRight } from "lucide-react";
import type { ProfessionalSummary } from "@/app/api/professionals/route";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function NpsBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-black/30 text-[12px]">—</span>;
  const color = value >= 9 ? "#0F6E56" : value >= 7 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-black/[.06]">
        <div className="h-full rounded-full" style={{ width: `${(value / 10) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] font-semibold" style={{ color }}>{value.toFixed(1)}</span>
    </div>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  clinic_owner: "Proprietário", staff: "Profissional", admin: "Admin",
};

export function ProfissionaisClient() {
  const [professionals, setProfessionals] = useState<ProfessionalSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/professionals")
      .then((r) => r.json())
      .then((d) => setProfessionals(d.professionals ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-black/30" />
      </div>
    );
  }

  if (professionals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-[#0F6E56]/10 flex items-center justify-center">
          <Users className="h-6 w-6 text-[#0F6E56]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#0F1A2E]">Nenhum profissional cadastrado</p>
          <p className="text-xs text-black/40 mt-0.5">
            Convide membros da equipe em{" "}
            <Link href="/settings/equipe" className="text-[#0F6E56] hover:underline">Configurações → Equipe</Link>
          </p>
        </div>
      </div>
    );
  }

  // Team totals
  const totalRevenue    = professionals.reduce((s, p) => s + p.revenueThisMonth, 0);
  const totalSessions   = professionals.reduce((s, p) => s + p.sessionsThisMonth, 0);
  const npsValues       = professionals.filter((p) => p.avgNps !== null).map((p) => p.avgNps!);
  const teamAvgNps      = npsValues.length > 0 ? Math.round(npsValues.reduce((s, v) => s + v, 0) / npsValues.length * 10) / 10 : null;

  return (
    <div className="space-y-6">
      {/* Team summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Profissionais", value: String(professionals.length), icon: Users },
          { label: "Sessões este mês", value: String(totalSessions), icon: BarChart3 },
          { label: "Receita este mês", value: formatBRL(totalRevenue), icon: TrendingUp },
          { label: "NPS médio equipe", value: teamAvgNps !== null ? teamAvgNps.toFixed(1) : "—", icon: Star },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-black/[.07] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/35">{label}</p>
              <Icon className="h-3.5 w-3.5 text-black/20" />
            </div>
            <p className="text-[20px] font-semibold tracking-[-0.02em] text-[#0F1A2E]">{value}</p>
          </div>
        ))}
      </div>

      {/* Individual cards */}
      <div className="space-y-2">
        {professionals
          .sort((a, b) => b.revenueThisMonth - a.revenueThisMonth)
          .map((pro) => (
            <Link
              key={pro.userId}
              href={`/profissionais/${pro.userId}`}
              className="group flex items-center gap-4 bg-white rounded-2xl border border-black/[.07] p-4 hover:border-black/[.12] hover:shadow-sm transition"
            >
              {/* Avatar */}
              <div className="shrink-0 w-10 h-10 rounded-full bg-[#0F1A2E]/10 flex items-center justify-center">
                <span className="text-[13px] font-bold text-[#0F1A2E]">{initials(pro.fullName)}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-[13px] font-semibold text-[#0F1A2E] truncate">
                    {pro.displayName ?? pro.fullName}
                  </p>
                  <span className="shrink-0 text-[10px] text-black/35 bg-black/[.05] rounded-full px-2 py-0.5">
                    {ROLE_LABELS[pro.role] ?? pro.role}
                  </span>
                </div>
                {pro.specialty && (
                  <p className="text-[11px] text-black/45 truncate mt-0.5">{pro.specialty}</p>
                )}
              </div>

              {/* Stats */}
              <div className="hidden sm:flex items-center gap-6 shrink-0">
                <div className="text-center">
                  <p className="text-[18px] font-semibold text-[#0F1A2E]">{pro.sessionsThisMonth}</p>
                  <p className="text-[10px] text-black/35">sessões</p>
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-semibold text-[#0F1A2E]">{formatBRL(pro.revenueThisMonth)}</p>
                  <p className="text-[10px] text-black/35">receita</p>
                </div>
                <div className="text-center min-w-[80px]">
                  <NpsBar value={pro.avgNps} />
                  <p className="text-[10px] text-black/35 mt-0.5">NPS</p>
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-semibold text-[#0F1A2E]">{pro.completionRate}%</p>
                  <p className="text-[10px] text-black/35">conclusão</p>
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-black/20 group-hover:text-black/40 shrink-0 transition" />
            </Link>
          ))}
      </div>

      <p className="text-center text-[11px] text-black/30">
        Clique em um profissional para ver o relatório detalhado
      </p>
    </div>
  );
}
