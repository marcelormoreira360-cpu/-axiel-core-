import OpenAI from "openai";

export interface ServiceBreakdown {
  name: string;
  sessions: number;
  revenue_cents: number;
}

export interface SourceBreakdown {
  source: string;
  count: number;
}

export interface MonthlyBreakdown {
  month: string;        // "jan/26"
  sessions: number;
  revenue_cents: number;
  new_patients: number;
}

export interface BusinessAnalytics {
  period: { from: string; to: string };
  months: number;
  revenue_cents: number;
  sessions_total: number;
  active_patients: number;
  new_patients: number;
  return_rate: number;
  avg_sessions_per_patient: number;
  conversion_rate: number;
  services: ServiceBreakdown[];
  sources: SourceBreakdown[];
  packages_sold: number;
  packages_revenue_cents: number;
  monthly: MonthlyBreakdown[];
  aiInsights: AiInsight[] | null;
}

export interface AiInsight {
  title: string;
  body: string;
  type: "opportunity" | "warning" | "highlight";
}

const SOURCE_PT: Record<string, string> = {
  direct: "Direto",
  referral: "Indicação",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  website: "Site",
  package: "Pacote",
  other: "Outro",
};

export async function getBusinessAnalytics(
  clinicId: string,
  months = 3
): Promise<BusinessAnalytics> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  const fromISO = from.toISOString();

  const [apptRes, patientsRes, leadsRes, offersRes, paymentsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, patient_id, source, session_type_id, session_types(name, price_cents), created_at, starts_at")
      .eq("clinic_id", clinicId)
      .gte("starts_at", fromISO),

    supabase
      .from("patients")
      .select("id, created_at, status")
      .eq("clinic_id", clinicId),

    supabase
      .from("leads")
      .select("id, stage")
      .eq("clinic_id", clinicId)
      .gte("created_at", fromISO),

    supabase
      .from("patient_offers")
      .select("id, created_at, monetization_offers(price_cents)")
      .eq("clinic_id", clinicId)
      .gte("created_at", fromISO),

    supabase
      .from("patient_payments")
      .select("amount_cents, payment_method, paid_at, appointment_id, patient_offer_id")
      .eq("clinic_id", clinicId)
      .gte("paid_at", fromISO),
  ]);

  const appointments = apptRes.data ?? [];
  const allPatients = patientsRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const offers = offersRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  // Revenue from explicit payments
  const revenueFromPayments = payments.reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  // Revenue from packages sold (fallback if no explicit payments yet)
  const packagesRevenue = offers.reduce((s, o) => {
    const raw = o.monetization_offers;
    const offer = (Array.isArray(raw) ? raw[0] : raw) as { price_cents: number } | null;
    return s + (offer?.price_cents ?? 0);
  }, 0);

  const revenue_cents = revenueFromPayments > 0 ? revenueFromPayments : packagesRevenue;

  // Sessions by service type
  const serviceMap = new Map<string, ServiceBreakdown>();
  for (const a of appointments) {
    const raw = a.session_types;
    const st = (Array.isArray(raw) ? raw[0] : raw) as { name: string; price_cents: number } | null;
    const name = st?.name ?? "Sem tipo";
    const price = st?.price_cents ?? 0;
    const existing = serviceMap.get(name) ?? { name, sessions: 0, revenue_cents: 0 };
    existing.sessions += 1;
    existing.revenue_cents += price;
    serviceMap.set(name, existing);
  }
  const services = [...serviceMap.values()].sort((a, b) => b.sessions - a.sessions);

  // Source breakdown
  const sourceMap = new Map<string, number>();
  for (const a of appointments) {
    const src = a.source ?? "other";
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
  }
  const sources: SourceBreakdown[] = [...sourceMap.entries()]
    .map(([source, count]) => ({ source: SOURCE_PT[source] ?? source, count }))
    .sort((a, b) => b.count - a.count);

  // Return rate
  const periodPatientIds = new Set(appointments.map((a) => a.patient_id));
  const newPatientIds = new Set(
    allPatients
      .filter((p) => new Date(p.created_at) >= from)
      .map((p) => p.id)
  );
  const returningCount = [...periodPatientIds].filter((id) => !newPatientIds.has(id)).length;
  const return_rate =
    periodPatientIds.size > 0
      ? Math.round((returningCount / periodPatientIds.size) * 100)
      : 0;

  // Avg sessions per patient this period
  const avg_sessions_per_patient =
    periodPatientIds.size > 0
      ? Math.round((appointments.length / periodPatientIds.size) * 10) / 10
      : 0;

  // Conversion rate (leads → patients)
  const convertedLeads = leads.filter((l) => l.stage === "converted_to_patient").length;
  const conversion_rate =
    leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0;

  const active_patients = allPatients.filter((p) => p.status === "active").length;
  const new_patients = allPatients.filter((p) => new Date(p.created_at) >= from).length;

  // Monthly breakdown — initialize all months in the range
  type MonthEntry = { sessions: number; session_revenue: number; new_patients: number };
  const monthlyMap = new Map<string, MonthEntry>();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
    const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    monthlyMap.set(key, { sessions: 0, session_revenue: 0, new_patients: 0 });
  }

  // Sessions per month (using session type price as revenue proxy)
  for (const a of appointments) {
    const d = new Date(a.starts_at);
    const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    const entry = monthlyMap.get(key);
    if (entry) {
      entry.sessions += 1;
      const raw = a.session_types;
      const st = (Array.isArray(raw) ? raw[0] : raw) as { name: string; price_cents: number } | null;
      entry.session_revenue += st?.price_cents ?? 0;
    }
  }

  // Payments per month (override session_revenue if payments exist)
  const paymentMonthlyMap = new Map<string, number>();
  for (const p of payments) {
    const d = new Date(p.paid_at);
    const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    paymentMonthlyMap.set(key, (paymentMonthlyMap.get(key) ?? 0) + (p.amount_cents ?? 0));
  }

  // New patients per month
  for (const p of allPatients) {
    if (new Date(p.created_at) >= from) {
      const d = new Date(p.created_at);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const entry = monthlyMap.get(key);
      if (entry) entry.new_patients += 1;
    }
  }

  const monthly: MonthlyBreakdown[] = [...monthlyMap.entries()].map(([month, v]) => {
    const payRevenue = paymentMonthlyMap.get(month) ?? 0;
    return {
      month,
      sessions: v.sessions,
      revenue_cents: payRevenue > 0 ? payRevenue : v.session_revenue,
      new_patients: v.new_patients,
    };
  });

  const analytics: BusinessAnalytics = {
    period: {
      from: from.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      to: now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    },
    months,
    revenue_cents,
    sessions_total: appointments.length,
    active_patients,
    new_patients,
    return_rate,
    avg_sessions_per_patient,
    conversion_rate,
    services,
    sources,
    packages_sold: offers.length,
    packages_revenue_cents: packagesRevenue,
    monthly,
    aiInsights: null,
  };

  return analytics;
}

// Exported so the dedicated /api/results/insights route can call it independently
// without blocking the main page render.
export async function generateAiInsights(data: Omit<BusinessAnalytics, "aiInsights">): Promise<AiInsight[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const client = new OpenAI({ apiKey });

  const prompt = `Você é um analista de negócios especializado em clínicas de saúde integrativa.
Analise os dados abaixo e retorne exatamente 4 insights acionáveis em JSON.

DADOS (${data.period.from} a ${data.period.to}):
- Receita total: R$ ${(data.revenue_cents / 100).toFixed(2)}
- Total de sessões: ${data.sessions_total}
- Pacientes ativos: ${data.active_patients}
- Novos pacientes: ${data.new_patients}
- Taxa de retorno: ${data.return_rate}%
- Média de sessões por paciente: ${data.avg_sessions_per_patient}
- Taxa de conversão (lead→paciente): ${data.conversion_rate}%
- Pacotes vendidos: ${data.packages_sold}
- Serviços por volume: ${JSON.stringify(data.services.map(s => ({ nome: s.name, sessoes: s.sessions, receita_cents: s.revenue_cents })))}
- Origens dos agendamentos: ${JSON.stringify(data.sources)}

Retorne APENAS um array JSON válido com exatamente 4 objetos, sem markdown, sem texto adicional:
[
  {
    "title": "título curto (máx 8 palavras)",
    "body": "observação e recomendação específica (2-3 frases)",
    "type": "opportunity" | "warning" | "highlight"
  }
]

Regras:
- type="highlight" para pontos positivos e forças
- type="opportunity" para crescimento e melhoria
- type="warning" para riscos e atenção
- Seja específico com os números reais dos dados
- Foque em decisões que o gestor pode tomar amanhã`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1024,
    temperature: 0.4,
  });

  const text = response.choices[0]?.message?.content ?? "";
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as AiInsight[];
}
