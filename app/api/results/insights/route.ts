import { NextResponse } from "next/server";
import { resolveLocale } from "@/i18n/get-locale";
import { getCurrentClinic } from "@/services/clinic-service";
import { getBusinessAnalytics, generateAiInsights } from "@/services/business-analytics-service";

export const maxDuration = 60; // allow up to 60s for GPT call on Vercel

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthsParam = parseInt(searchParams.get("months") ?? "3", 10);
    const months = [1, 3, 6, 12].includes(monthsParam) ? monthsParam : 3;

    const clinic = await getCurrentClinic();
    if (!clinic) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Painel INTERNO (gestor lê) → idioma da clínica (locale da UI).
    const locale = await resolveLocale();

    // Get analytics data (fast — DB only, no GPT)
    const data = await getBusinessAnalytics(clinic.id, months, locale);

    // Generate AI insights (slow — GPT call)
    const insights = await generateAiInsights(data, locale);

    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({ insights: [] });
  }
}
