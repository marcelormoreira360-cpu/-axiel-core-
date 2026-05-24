import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

// ── Rule definitions ──────────────────────────────────────────────────────────

export interface RuleDef {
  key: "d_minus_1" | "nps" | "d_plus_3" | "d_plus_30";
  tag: string;            // internal tag used in follow_ups.notes
  title: string;
  description: string;
  timing: string;         // human-readable trigger description
  defaultTemplate: string;
  variables: string[];    // available interpolation variables
}

export interface AutomacaoRule extends RuleDef {
  isEnabled: boolean;
  template: string;      // custom template or default
  sentLast30d: number;   // stats from communication_logs
  sentTotal: number;
}

const RULES: RuleDef[] = [
  {
    key: "d_minus_1",
    tag: "d-1",
    title: "Lembrete D-1",
    description: "Enviado 1 dia antes da sessão para reduzir no-show.",
    timing: "24h antes da sessão",
    variables: ["{{nome}}", "{{horario}}", "{{data}}"],
    defaultTemplate:
      "Olá, {{nome}}! 👋\n\nLembrete: sua sessão é *amanhã* às {{horario}}. 📅\n\nAté lá!",
  },
  {
    key: "nps",
    tag: "nps",
    title: "NPS Pós-Sessão",
    description: "Pede avaliação 1 dia após a sessão para medir satisfação.",
    timing: "24h após a sessão",
    variables: ["{{nome}}"],
    defaultTemplate:
      "Olá, {{nome}}! 🌿\n\nComo foi sua sessão de ontem? Sua avaliação nos ajuda a melhorar cada vez mais.\n\nAcesse seu portal pelo link que você recebeu e deixe sua nota — leva menos de 1 minuto! ⭐",
  },
  {
    key: "d_plus_3",
    tag: "d+3",
    title: "Acompanhamento D+3",
    description: "Verifica o bem-estar do paciente 3 dias após a sessão.",
    timing: "3 dias após a sessão",
    variables: ["{{nome}}"],
    defaultTemplate:
      "Olá, {{nome}}! 😊\n\nJá se passaram alguns dias desde a sua sessão. Como está se sentindo?\n\nSe tiver dúvidas ou quiser agendar o próximo atendimento, estou aqui. 🌿",
  },
  {
    key: "d_plus_30",
    tag: "d+30",
    title: "Fidelização D+30",
    description: "Incentiva novo agendamento 30 dias após a última sessão.",
    timing: "30 dias após a sessão",
    variables: ["{{nome}}"],
    defaultTemplate:
      "Olá, {{nome}}! 🌟\n\nFaz 30 dias desde a sua última sessão — sentiu evolução? 💪\n\nQue tal agendar o próximo atendimento para continuar o seu progresso?",
  },
];

// ── GET /api/automacoes ───────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: cu } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!cu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clinicId = cu.clinic_id as string;
  const admin = createSupabaseAdminClient();

  // Fetch clinic settings (enabled/disabled per rule)
  const { data: cs } = await admin
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const reminders = (cs?.settings as Record<string, unknown> | null)?.reminders as Record<string, boolean> | undefined;
  const isEnabled = (key: string) => (reminders ? reminders[key] !== false : true);

  // Fetch custom templates
  const { data: templates } = await admin
    .from("automation_templates")
    .select("rule_key, template")
    .eq("clinic_id", clinicId)
    .eq("channel", "whatsapp");
  const templateMap = new Map((templates ?? []).map((t) => [t.rule_key as string, t.template as string]));

  // Stats: last 30 days + total per rule use_case
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const useCaseByKey: Record<string, string> = {
    d_minus_1: "appointment_reminder",
    nps: "nps_feedback",
    d_plus_3: "follow_up",
    d_plus_30: "follow_up",
  };

  // Count follow_ups by notes tag (more accurate than communication_logs use_case collision for d+3/d+30)
  const tagByKey: Record<string, string> = {
    d_minus_1: "d-1",
    nps: "nps",
    d_plus_3: "d+3",
    d_plus_30: "d+30",
  };

  const [{ data: recent }, { data: total }] = await Promise.all([
    admin
      .from("follow_ups")
      .select("notes")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .in("notes", ["d-1", "nps", "d+3", "d+30"])
      .gte("updated_at", since30d),
    admin
      .from("follow_ups")
      .select("notes")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .in("notes", ["d-1", "nps", "d+3", "d+30"]),
  ]);

  const countBy = (rows: { notes: string }[] | null, tag: string) =>
    (rows ?? []).filter((r) => r.notes === tag).length;

  const result: AutomacaoRule[] = RULES.map((rule) => ({
    ...rule,
    isEnabled: isEnabled(rule.key),
    template: templateMap.get(rule.key) ?? rule.defaultTemplate,
    sentLast30d: countBy(recent, rule.tag),
    sentTotal: countBy(total, rule.tag),
  }));

  return NextResponse.json(result);
}

// ── PUT /api/automacoes ───────────────────────────────────────────────────────
// Body: { key, action: "toggle" | "template", value: boolean | string }

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: cu } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!cu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clinicId = cu.clinic_id as string;
  const admin = createSupabaseAdminClient();

  const body = (await request.json()) as {
    key: string;
    action: "toggle" | "template";
    value: boolean | string;
  };

  const validKeys = ["d_minus_1", "nps", "d_plus_3", "d_plus_30"];
  if (!validKeys.includes(body.key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (body.action === "toggle") {
    // Update clinic_settings.settings.reminders[key]
    const { data: cs } = await admin
      .from("clinic_settings")
      .select("id, settings")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    const settings = (cs?.settings as Record<string, unknown> | null) ?? {};
    const reminders = ((settings.reminders as Record<string, boolean> | undefined) ?? {}) as Record<string, boolean>;
    reminders[body.key] = body.value as boolean;
    const newSettings = { ...settings, reminders };

    if (cs?.id) {
      await admin
        .from("clinic_settings")
        .update({ settings: newSettings })
        .eq("id", cs.id as string);
    } else {
      await admin
        .from("clinic_settings")
        .insert({ clinic_id: clinicId, settings: newSettings });
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action === "template") {
    const tpl = (body.value as string).trim();
    if (tpl.length < 10 || tpl.length > 1500) {
      return NextResponse.json({ error: "Template must be 10–1500 characters" }, { status: 400 });
    }

    await admin
      .from("automation_templates")
      .upsert(
        { clinic_id: clinicId, rule_key: body.key, channel: "whatsapp", template: tpl, updated_at: new Date().toISOString() },
        { onConflict: "clinic_id,rule_key,channel" }
      );

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
