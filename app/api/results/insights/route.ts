import { NextResponse } from "next/server";
import { resolveLocale } from "@/i18n/get-locale";
import { getCurrentClinic } from "@/services/clinic-service";
import {
  getBusinessAnalytics,
  generateAiInsights,
  getLatestBusinessInsight,
  saveBusinessInsight,
} from "@/services/business-analytics-service";

export const maxDuration = 60; // allow up to 60s for GPT call on Vercel

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthsParam = parseInt(searchParams.get("months") ?? "3", 10);
    const months = [1, 3, 6, 12].includes(monthsParam) ? monthsParam : 3;
    // refresh=1 força regenerar (botão "atualizar"); senão serve o cache (TTL 6h).
    const refresh = searchParams.get("refresh") === "1";

    const clinic = await getCurrentClinic();
    if (!clinic) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Painel INTERNO (gestor lê) → idioma da clínica (locale da UI).
    const locale = await resolveLocale();

    // Cache: serve o insight recente sem repetir o GPT (antes era regerado a cada
    // abertura da página e a cada troca de período 1/3/6/12).
    if (!refresh) {
      const cached = await getLatestBusinessInsight(clinic.id, months, locale);
      if (cached) return NextResponse.json({ insights: cached, cached: true });
    }

    // Get analytics data (fast — DB only, no GPT)
    const data = await getBusinessAnalytics(clinic.id, months, locale);

    // Generate AI insights (slow — GPT call)
    const insights = await generateAiInsights(data, locale);
    // Só cacheia resultado válido (não cacheia [] p/ não esconder insights por 6h).
    if (insights.length > 0) {
      await saveBusinessInsight(clinic.id, months, locale, insights);
    }

    return NextResponse.json({ insights, cached: false });
  } catch {
    return NextResponse.json({ insights: [] });
  }
}
