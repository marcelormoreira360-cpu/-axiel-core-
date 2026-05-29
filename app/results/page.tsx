import dynamic from "next/dynamic";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { getCurrentClinic } from "@/services/clinic-service";
import { getBusinessAnalytics } from "@/services/business-analytics-service";

const ResultsChart = dynamic(
  () => import("@/components/results-chart").then((m) => m.ResultsChart),
  { loading: () => <div className="h-[228px] animate-pulse rounded-[12px] bg-black/[.03]" /> }
);

const ResultsExportButton = dynamic(
  () => import("@/components/results-export-button").then((m) => m.ResultsExportButton),
  { ssr: false }
);

function fmt(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TYPE_STYLE = {
  highlight:   { bg: "bg-[#E1F5EE]", border: "border-[#9FE1CB]", dot: "bg-[#0F6E56]", text: "text-[#085041]" },
  opportunity: { bg: "bg-[#EEF2FF]", border: "border-[#C7D2FE]", dot: "bg-[#4F46E5]", text: "text-[#3730A3]" },
  warning:     { bg: "bg-amber-50",  border: "border-amber-200",  dot: "bg-amber-400",  text: "text-amber-800" },
};

const PERIOD_OPTIONS = [
  { label: "1 mês",   value: 1 },
  { label: "3 meses", value: 3 },
  { label: "6 meses", value: 6 },
  { label: "12 meses",value: 12 },
];

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>;
}) {
  const sp = await searchParams;
  const monthsParam = parseInt(sp.months ?? "3", 10);
  const months = [1, 3, 6, 12].includes(monthsParam) ? monthsParam : 3;

  const clinic = await getCurrentClinic();
  const data = clinic ? await getBusinessAnalytics(clinic.id, months) : null;

  if (!data) {
    return (
      <Shell>
        <p className="text-[13px] text-[#A09E98]">Clínica não encontrada.</p>
      </Shell>
    );
  }

  const topService = data.services[0];

  return (
    <Shell>
      {/* Header */}
      <div className="mb-[18px] flex items-start justify-between gap-[12px]">
        <div>
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98]">Resultados</p>
          <h1 className="mt-[4px] text-[20px] font-semibold tracking-[-0.025em] text-[#0F1A2E]">
            Análise de Negócio
          </h1>
          <p className="mt-[2px] text-[12px] text-[#A09E98]">
            {data.period.from} → {data.period.to}
          </p>
        </div>
        <ResultsExportButton data={data} />
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-[6px] mb-[18px]">
        {PERIOD_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/results?months=${opt.value}`}
            className={[
              "px-[12px] py-[6px] rounded-[8px] text-[11px] font-medium transition",
              months === opt.value
                ? "bg-[#0F1A2E] text-white"
                : "bg-white border border-black/[.09] text-[#6B6A66] hover:bg-[#F4F3EF]",
            ].join(" ")}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] mb-[14px]">
        {[
          { label: "RECEITA",           value: fmt(data.revenue_cents),              sub: `${data.packages_sold} pacote${data.packages_sold !== 1 ? "s" : ""} vendido${data.packages_sold !== 1 ? "s" : ""}` },
          { label: "SESSÕES",           value: String(data.sessions_total),           sub: `${data.avg_sessions_per_patient}× por paciente` },
          { label: "TAXA DE RETORNO",   value: `${data.return_rate}%`,               sub: `${data.active_patients} pacientes ativos`, green: data.return_rate >= 60 },
          { label: "CONVERSÃO LEADS",   value: `${data.conversion_rate}%`,           sub: `${data.new_patients} novo${data.new_patients !== 1 ? "s" : ""} este período` },
        ].map((m) => (
          <div key={m.label} className="bg-white border border-black/[.07] rounded-[10px] p-[13px]">
            <p className="text-[10px] text-[#A09E98] tracking-[.04em] mb-[5px]">{m.label}</p>
            <p className={`text-[20px] font-medium tracking-[-0.03em] leading-none ${m.green ? "text-[#0F6E56]" : "text-[#0F1A2E]"}`}>
              {m.value}
            </p>
            <p className="text-[10px] mt-[3px] text-[#A09E98]">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart — evolução mensal (só mostra se tiver ≥ 2 meses) */}
      {months >= 2 && (
        <div className="mb-[14px]">
          <ResultsChart monthly={data.monthly} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-[12px]">

        {/* Coluna esquerda */}
        <div className="space-y-[12px]">

          {/* Serviços */}
          <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
            <p className="text-[12px] font-medium text-[#0F1A2E] mb-[12px]">Serviços — volume e receita</p>
            {data.services.length === 0 ? (
              <p className="text-[12px] text-[#A09E98]">
                Nenhum tipo de serviço associado aos agendamentos ainda.{" "}
                <span className="text-[#0F6E56]">Configure tipos de sessão com preço em Configurações → Tipos de Sessão.</span>
              </p>
            ) : (
              <div className="space-y-[8px]">
                {data.services.map((s) => {
                  const pct = data.sessions_total > 0
                    ? Math.round((s.sessions / data.sessions_total) * 100)
                    : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-[3px]">
                        <span className="text-[12px] text-[#0F1A2E] font-medium">{s.name}</span>
                        <div className="flex items-center gap-[10px]">
                          <span className="text-[11px] text-[#A09E98]">{s.sessions} sessões</span>
                          {s.revenue_cents > 0 && (
                            <span className="text-[11px] font-medium text-[#0F6E56]">{fmt(s.revenue_cents)}</span>
                          )}
                        </div>
                      </div>
                      <div className="h-[5px] rounded-full bg-[#F4F3EF]">
                        <div
                          className="h-full rounded-full bg-[#0F6E56]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Origem dos agendamentos */}
          <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
            <p className="text-[12px] font-medium text-[#0F1A2E] mb-[12px]">Origem dos agendamentos</p>
            {data.sources.length === 0 ? (
              <p className="text-[12px] text-[#A09E98]">
                Origem não registrada ainda. A partir de agora, o campo será capturado em cada agendamento.
              </p>
            ) : (
              <div className="space-y-[8px]">
                {data.sources.map((s) => {
                  const pct = data.sessions_total > 0
                    ? Math.round((s.count / data.sessions_total) * 100)
                    : 0;
                  return (
                    <div key={s.source}>
                      <div className="flex items-center justify-between mb-[3px]">
                        <span className="text-[12px] text-[#0F1A2E]">{s.source}</span>
                        <span className="text-[11px] text-[#A09E98]">{s.count} ({pct}%)</span>
                      </div>
                      <div className="h-[5px] rounded-full bg-[#F4F3EF]">
                        <div
                          className="h-full rounded-full bg-[#3D2E8F]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo financeiro */}
          <div className="bg-[#0F1A2E] rounded-[12px] p-[15px]">
            <p className="text-[10px] font-medium text-white/40 tracking-[.08em] uppercase mb-[10px]">
              Resumo financeiro
            </p>
            <div className="space-y-[8px]">
              {[
                { label: "Receita (pacotes)",    value: fmt(data.packages_revenue_cents) },
                { label: "Pacotes vendidos",     value: String(data.packages_sold) },
                { label: "Ticket médio/pacote",  value: data.packages_sold > 0 ? fmt(Math.round(data.packages_revenue_cents / data.packages_sold)) : "—" },
                { label: "Sessões no período",   value: String(data.sessions_total) },
                topService ? { label: "Serviço líder", value: topService.name } : null,
              ].filter(Boolean).map((item) => (
                <div key={item!.label} className="flex items-center justify-between">
                  <p className="text-[12px] text-white/60">{item!.label}</p>
                  <p className="text-[13px] font-semibold text-white">{item!.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna direita — AI Insights */}
        <div className="space-y-[12px]">
          <div>
            <p className="text-[12px] font-medium text-[#0F1A2E]">Análise por IA</p>
            <p className="text-[11px] text-[#A09E98] mt-[2px]">
              Claude analisa seus dados e aponta o que fazer a seguir.
            </p>
          </div>

          {data.aiInsights === null || data.aiInsights.length === 0 ? (
            <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
              <p className="text-[12px] text-[#A09E98]">
                Análise de IA indisponível — configure{" "}
                <code className="text-[11px] bg-[#F4F3EF] px-1 rounded">OPENAI_API_KEY</code>{" "}
                no Vercel para ativar.
              </p>
            </div>
          ) : (
            data.aiInsights.map((insight, i) => {
              const s = TYPE_STYLE[insight.type] ?? TYPE_STYLE.highlight;
              return (
                <div
                  key={i}
                  className={`rounded-[12px] border p-[14px] ${s.bg} ${s.border}`}
                >
                  <div className="flex items-start gap-[8px]">
                    <div className={`w-[7px] h-[7px] rounded-full mt-[4px] shrink-0 ${s.dot}`} />
                    <div>
                      <p className={`text-[12px] font-semibold ${s.text}`}>{insight.title}</p>
                      <p className={`text-[12px] mt-[4px] leading-relaxed ${s.text} opacity-80`}>
                        {insight.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Métricas de retenção */}
          <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
            <p className="text-[12px] font-medium text-[#0F1A2E] mb-[10px]">Retenção e engajamento</p>
            <div className="space-y-[10px]">
              {[
                { label: "Taxa de retorno",         value: `${data.return_rate}%`,              note: "pacientes que voltaram" },
                { label: "Sessões por paciente",    value: `${data.avg_sessions_per_patient}×`,  note: "média no período" },
                { label: "Novos pacientes",         value: String(data.new_patients),            note: "no período" },
                { label: "Conv. leads → pacientes", value: `${data.conversion_rate}%`,           note: "taxa de fechamento" },
              ].map((m) => (
                <div key={m.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] text-[#0F1A2E]">{m.label}</p>
                    <p className="text-[10px] text-[#A09E98]">{m.note}</p>
                  </div>
                  <p className="text-[15px] font-semibold text-[#0F1A2E]">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
