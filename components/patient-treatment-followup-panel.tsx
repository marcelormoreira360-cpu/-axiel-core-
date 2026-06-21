"use client";

import Link from "next/link";
import { ClipboardList, Plus, ChevronRight, TrendingUp, ExternalLink } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { SessionRecord } from "@/lib/types";
import type { AssessmentSeries } from "@/services/evolution-service";

/**
 * Acompanhamento do Tratamento (agregador da ficha): o Resumo do caso direciona,
 * cada sessão é uma nota (SOAP, amarrada ao agendamento) e a Evolução clínica
 * aparece sempre como um gráfico inline + link pro detalhe. Unifica notas de
 * sessão e evolução clínica num só lugar.
 */

const LINE_COLORS = ["#0F6E56", "#C2410C", "#1D4ED8", "#9333EA", "#0891B2"];

function fmtDate(iso: string) {
  return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function noteSummary(s: SessionRecord): string {
  return (
    s.notes ||
    s.subjective ||
    s.plan ||
    s.assessment_note ||
    (s.key_observations?.length ? s.key_observations.join(" · ") : "") ||
    "Sessão registrada"
  ).trim();
}

function buildChartData(series: AssessmentSeries[]) {
  const byDate = new Map<string, Record<string, number | string>>();
  for (const s of series) {
    for (const p of s.points) {
      const key = p.date.slice(0, 10);
      if (!byDate.has(key)) byDate.set(key, { date: key });
      byDate.get(key)![s.name] = Math.round(p.score_percentage);
    }
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export function PatientTreatmentFollowupPanel({
  patientId,
  sessions,
  assessments,
}: {
  patientId: string;
  sessions: SessionRecord[];
  assessments: AssessmentSeries[];
}) {
  const chartData = buildChartData(assessments);
  const hasChart = chartData.length > 0;
  const recent = sessions.slice(0, 4);

  return (
    <div className="bg-white border border-t-0 border-black/[.07] px-[22px] py-[16px]">
      <div className="flex items-center justify-between mb-[12px]">
        <span className="flex items-center gap-[7px] text-[13px] font-medium text-[#0F1A2E]">
          <ClipboardList className="h-[16px] w-[16px] text-[#0F6E56]" /> Acompanhamento do tratamento
        </span>
        <Link
          href={`/schedule/new?patient_id=${patientId}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] border border-black/[.08] rounded-[6px] px-[10px] py-[5px] hover:bg-[#F0FAF6] transition"
        >
          <Plus className="h-3 w-3" /> Nota de sessão
        </Link>
      </div>

      {/* Notas por sessão (cada sessão = 1 entrada, clicável p/ o detalhe) */}
      {recent.length === 0 ? (
        <p className="text-[12px] text-[#A09E98] mb-[14px]">
          Nenhuma nota de sessão ainda. Registre a primeira no fluxo da sessão.
        </p>
      ) : (
        <div className="divide-y divide-black/[.05] border-t border-black/[.05] mb-[14px]">
          {recent.map((s, i) => {
            const date = s.appointments?.starts_at ?? s.created_at;
            return (
              <Link
                key={s.id}
                href={`/schedule/${s.appointment_id}/session`}
                className="flex items-start gap-[10px] py-[9px] -mx-[6px] px-[6px] rounded-[6px] hover:bg-[#FAFAF8] transition group"
              >
                <span className="text-[11px] text-[#A09E98] w-[52px] shrink-0 pt-[1px]">{fmtDate(date)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-[#0F1A2E] leading-[1.5] line-clamp-2">
                    <span className="font-medium">Sessão {sessions.length - i} · </span>
                    {noteSummary(s)}
                  </p>
                  {s.soap_mode && (
                    <span className="inline-block mt-[4px] text-[10px] bg-[#E1F5EE] text-[#085041] rounded-[4px] px-[6px] py-[1px]">
                      SOAP
                    </span>
                  )}
                </div>
                <ChevronRight className="h-[15px] w-[15px] text-[#D3D1C7] group-hover:text-[#0F6E56] transition self-center shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      {/* Evolução clínica — gráfico inline + link pro detalhe (sempre presente) */}
      <div className="border-t border-black/[.05] pt-[12px]">
        <div className="flex items-center justify-between mb-[8px]">
          <span className="flex items-center gap-[6px] text-[11px] font-medium text-[#6B6A66]">
            <TrendingUp className="h-[13px] w-[13px]" /> Evolução clínica{" "}
            <span className="font-normal text-[#A09E98]">· menor = melhor</span>
          </span>
          <Link
            href={`/patients/${patientId}/evolution`}
            className="inline-flex items-center gap-1 text-[11px] text-[#0F6E56] hover:underline"
          >
            ver gráfico completo <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        {hasChart ? (
          <div className="h-[130px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEA" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => fmtDate(String(v))}
                  tick={{ fontSize: 10, fill: "#A09E98" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "#A09E98" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #eee" }}
                  labelFormatter={(v) => fmtDate(String(v))}
                />
                {assessments.map((s, i) => (
                  <Line
                    key={s.template_id}
                    type="monotone"
                    dataKey={s.name}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[11px] text-[#A09E98] py-[8px]">
            O gráfico aparece conforme os questionários e marcadores forem reavaliados ao longo do tratamento.
          </p>
        )}
      </div>
    </div>
  );
}
