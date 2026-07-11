import OpenAI from "openai";
import { languageInstruction } from "@/lib/ai-language";
import { chatModel } from "@/lib/ai-models";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getFinanceKPIs,
  getMonthlyRevenue,
  getClinicCurrency,
  paymentMethodLabel,
} from "./finance-service";
import { formatMoney } from "@/lib/finance-utils";
import { getRepasseHistory } from "./repasse-service";
import type { PaymentMethod } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────

export interface FinanceAIInsight {
  summary: string;
  alerts: string[];
  opportunities: string[];
  suggestions: string[];
  projection: string;
  generated_at: string;
  period_month: string;
}

// ── Cache (6 hours) ───────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function getLatestFinanceInsight(
  clinicId: string,
): Promise<FinanceAIInsight | null> {
  const supabase = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

  const { data } = await supabase
    .from("finance_insights")
    .select("content, generated_at, period_month")
    .eq("clinic_id", clinicId)
    .gte("generated_at", cutoff)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  return {
    ...(data.content as Omit<FinanceAIInsight, "generated_at" | "period_month">),
    generated_at: data.generated_at as string,
    period_month: data.period_month as string,
  };
}

// ── Generation ────────────────────────────────────────────────────

export async function generateFinanceInsight(
  clinicId: string,
  // Material INTERNO (gestor lê) → idioma da CLÍNICA (locale da UI). Default pt-BR.
  clinicLocale?: string | null,
): Promise<FinanceAIInsight> {
  const [kpis, monthly, repasse, __cur] = await Promise.all([
    getFinanceKPIs(clinicId),
    getMonthlyRevenue(clinicId),
    getRepasseHistory(clinicId),
    getClinicCurrency(clinicId),
  ]);
  const locale = clinicLocale ?? "pt-BR";
  const formatBRL = (c: number) => formatMoney(c, __cur, locale);

  // Build context strings
  const delta =
    kpis.revenueLastMonth > 0
      ? ((kpis.revenueThisMonth - kpis.revenueLastMonth) / kpis.revenueLastMonth * 100).toFixed(1)
      : null;

  const monthlyText = monthly
    .map((m) => `${m.month}: ${formatBRL(m.cents)}`)
    .join("\n");

  const methodBreakdown = Object.entries(kpis.revenueThisMonthByMethod)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([m, v]) => `${paymentMethodLabel(m as PaymentMethod)}: ${formatBRL(v)}`)
    .join(" | ");

  const repasseText =
    repasse.length > 0
      ? repasse
          .slice(0, 5)
          .map(
            (r) =>
              `${r.professional_name ?? "Profissional"} — ${r.period_month}: repasse ${formatBRL(r.repasse_cents)} (${r.sessions_count} sessões, ${r.status === "paid" ? "pago" : "pendente"})`,
          )
          .join("\n")
      : "Nenhum repasse configurado.";

  const prompt = `Você é um consultor financeiro especialista em clínicas de saúde integrativa no Brasil.
Analise os dados financeiros abaixo e retorne insights acionáveis para o gestor da clínica.

## Dados do mês atual
- Receita: ${formatBRL(kpis.revenueThisMonth)}${delta !== null ? ` (${Number(delta) >= 0 ? "+" : ""}${delta}% vs mês anterior)` : ""}
- Receita mês anterior: ${formatBRL(kpis.revenueLastMonth)}
- Total de pagamentos recebidos: ${kpis.totalPaymentsThisMonth}
- Ticket médio: ${formatBRL(kpis.averageTicketCents)}
- Sessões sem pagamento registrado: ${kpis.pendingCount}${kpis.pendingEstimatedCents > 0 ? ` (~${formatBRL(kpis.pendingEstimatedCents)} estimado)` : ""}

## Receita por forma de pagamento (mês atual)
${methodBreakdown || "Nenhum pagamento registrado."}

## Histórico dos últimos 6 meses
${monthlyText}

## Repasse de colaboradores (recente)
${repasseText}

## Instruções de resposta
Responda SOMENTE com JSON válido, sem markdown nem explicações fora do JSON.
Use linguagem direta e prática. ${languageInstruction(locale)}
Seja específico com valores quando relevante.
Máximo 3 itens por lista.

Formato exato:
{
  "summary": "resumo narrativo de 2–3 frases sobre a saúde financeira atual da clínica",
  "alerts": ["alerta urgente 1", "alerta urgente 2"],
  "opportunities": ["oportunidade identificada 1", "oportunidade identificada 2"],
  "suggestions": ["ação concreta 1", "ação concreta 2", "ação concreta 3"],
  "projection": "projeção para o próximo mês com base na tendência atual (1 frase)"
}`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: chatModel(),
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(raw) as Omit<FinanceAIInsight, "generated_at" | "period_month">;

  const now = new Date().toISOString();
  const periodMonth = now.slice(0, 7);

  // Persist to cache
  const supabase = createSupabaseAdminClient();
  await supabase.from("finance_insights").insert({
    clinic_id: clinicId,
    period_month: periodMonth,
    content: parsed,
    generated_at: now,
  });

  return { ...parsed, generated_at: now, period_month: periodMonth };
}
