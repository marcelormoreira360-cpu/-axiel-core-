import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import crypto from "node:crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuleDef {
  key: string;
  tag: string;
  title: string;
  description: string;
  timing: string;
  defaultTemplate: string;
  variables: string[];
}

export interface AutomacaoRule extends RuleDef {
  isEnabled: boolean;
  template: string;
  sentLast30d: number;
  sentTotal: number;
  isCustom: boolean;
}

export interface CustomRuleSettings {
  id: string;
  title: string;
  description: string;
  offsetDays: number;
  triggerType: "before_session" | "after_session";
  template: string;
  isEnabled: boolean;
  createdAt: string;
}

// ── Default rule definitions ──────────────────────────────────────────────────

const DEFAULT_RULES: RuleDef[] = [
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

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getClinicId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: cu } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return (cu?.clinic_id as string | null) ?? null;
}

// ── GET /api/automacoes ───────────────────────────────────────────────────────

export async function GET() {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdminClient();

  // Load clinic settings
  const { data: cs } = await admin
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const settings = (cs?.settings as Record<string, unknown> | null) ?? {};
  const reminders = (settings.reminders as Record<string, boolean> | undefined) ?? {};
  const deletedRules = (settings.deleted_rules as string[] | undefined) ?? [];
  const customRules = (settings.custom_rules as CustomRuleSettings[] | undefined) ?? [];

  const isEnabled = (key: string) => reminders[key] !== false;

  // Fetch custom templates for default rules
  const { data: templates } = await admin
    .from("automation_templates")
    .select("rule_key, template")
    .eq("clinic_id", clinicId)
    .eq("channel", "whatsapp");
  const templateMap = new Map((templates ?? []).map((t) => [t.rule_key as string, t.template as string]));

  // Stats from follow_ups
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // All tags we care about: default + custom
  const defaultTags = DEFAULT_RULES.map((r) => r.tag);
  const customTags = customRules.map((r) => `custom:${r.id}`);
  const allTags = [...defaultTags, ...customTags];

  const [{ data: recent }, { data: total }] = await Promise.all([
    admin
      .from("follow_ups")
      .select("notes")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .in("notes", allTags)
      .gte("updated_at", since30d),
    admin
      .from("follow_ups")
      .select("notes")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .in("notes", allTags),
  ]);

  const countBy = (rows: { notes: string }[] | null, tag: string) =>
    (rows ?? []).filter((r) => r.notes === tag).length;

  // Build default rules (excluding deleted)
  const defaultResult: AutomacaoRule[] = DEFAULT_RULES
    .filter((rule) => !deletedRules.includes(rule.key))
    .map((rule) => ({
      ...rule,
      isEnabled: isEnabled(rule.key),
      template: templateMap.get(rule.key) ?? rule.defaultTemplate,
      sentLast30d: countBy(recent, rule.tag),
      sentTotal: countBy(total, rule.tag),
      isCustom: false,
    }));

  // Build custom rules
  const customResult: AutomacaoRule[] = customRules.map((cr) => {
    const tag = `custom:${cr.id}`;
    const timingLabel =
      cr.offsetDays === 0
        ? "No dia da sessão"
        : cr.offsetDays < 0
        ? `${Math.abs(cr.offsetDays)} dia${Math.abs(cr.offsetDays) > 1 ? "s" : ""} antes da sessão`
        : `${cr.offsetDays} dia${cr.offsetDays > 1 ? "s" : ""} após a sessão`;
    return {
      key: `custom_${cr.id}`,
      tag,
      title: cr.title,
      description: cr.description,
      timing: timingLabel,
      defaultTemplate: cr.template,
      variables: ["{{nome}}", "{{horario}}", "{{data}}"],
      isEnabled: cr.isEnabled,
      template: cr.template,
      sentLast30d: countBy(recent, tag),
      sentTotal: countBy(total, tag),
      isCustom: true,
    };
  });

  return NextResponse.json([...defaultResult, ...customResult]);
}

// ── POST /api/automacoes — create custom rule ─────────────────────────────────

export async function POST(request: Request) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    title: string;
    description?: string;
    offsetDays: number;
    triggerType: "before_session" | "after_session";
    template: string;
  };

  if (!body.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!body.template?.trim() || body.template.length < 10) return NextResponse.json({ error: "Template too short" }, { status: 400 });
  if (!Number.isInteger(body.offsetDays)) return NextResponse.json({ error: "Invalid offsetDays" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: cs } = await admin
    .from("clinic_settings")
    .select("id, settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const settings = (cs?.settings as Record<string, unknown> | null) ?? {};
  const customRules = (settings.custom_rules as CustomRuleSettings[] | undefined) ?? [];

  const newRule: CustomRuleSettings = {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    description: (body.description ?? "").trim() || `Enviado ${Math.abs(body.offsetDays)} dia(s) ${body.triggerType === "before_session" ? "antes" : "após"} a sessão.`,
    offsetDays: body.triggerType === "before_session" ? -Math.abs(body.offsetDays) : Math.abs(body.offsetDays),
    triggerType: body.triggerType,
    template: body.template.trim(),
    isEnabled: true,
    createdAt: new Date().toISOString(),
  };

  const newSettings = { ...settings, custom_rules: [...customRules, newRule] };

  if (cs?.id) {
    await admin.from("clinic_settings").update({ settings: newSettings }).eq("id", cs.id as string);
  } else {
    await admin.from("clinic_settings").insert({ clinic_id: clinicId, settings: newSettings });
  }

  return NextResponse.json({ ok: true, id: newRule.id });
}

// ── PUT /api/automacoes — toggle / template / delete-default ──────────────────

export async function PUT(request: Request) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    key: string;
    action: "toggle" | "template" | "delete";
    value?: boolean | string;
  };

  const admin = createSupabaseAdminClient();
  const { data: cs } = await admin
    .from("clinic_settings")
    .select("id, settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const settings = (cs?.settings as Record<string, unknown> | null) ?? {};

  async function saveSettings(newSettings: Record<string, unknown>) {
    if (cs?.id) {
      await admin.from("clinic_settings").update({ settings: newSettings }).eq("id", cs.id as string);
    } else {
      await admin.from("clinic_settings").insert({ clinic_id: clinicId, settings: newSettings });
    }
  }

  // Handle custom rule toggle/template
  if (body.key.startsWith("custom_")) {
    const ruleId = body.key.replace("custom_", "");
    const customRules = (settings.custom_rules as CustomRuleSettings[] | undefined) ?? [];

    if (body.action === "toggle") {
      const updated = customRules.map((r) =>
        r.id === ruleId ? { ...r, isEnabled: body.value as boolean } : r
      );
      await saveSettings({ ...settings, custom_rules: updated });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "template") {
      const tpl = (body.value as string).trim();
      if (tpl.length < 10 || tpl.length > 1500) {
        return NextResponse.json({ error: "Template must be 10–1500 characters" }, { status: 400 });
      }
      const updated = customRules.map((r) =>
        r.id === ruleId ? { ...r, template: tpl } : r
      );
      await saveSettings({ ...settings, custom_rules: updated });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action for custom rule" }, { status: 400 });
  }

  // Handle default rule actions
  const validKeys = ["d_minus_1", "nps", "d_plus_3", "d_plus_30"];
  if (!validKeys.includes(body.key)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  if (body.action === "delete") {
    const deletedRules = (settings.deleted_rules as string[] | undefined) ?? [];
    if (!deletedRules.includes(body.key)) {
      await saveSettings({ ...settings, deleted_rules: [...deletedRules, body.key] });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "toggle") {
    const reminders = ((settings.reminders as Record<string, boolean> | undefined) ?? {}) as Record<string, boolean>;
    reminders[body.key] = body.value as boolean;
    await saveSettings({ ...settings, reminders });
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

// ── DELETE /api/automacoes — remove custom rule ───────────────────────────────

export async function DELETE(request: Request) {
  const clinicId = await getClinicId();
  if (!clinicId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = (await request.json()) as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: cs } = await admin
    .from("clinic_settings")
    .select("id, settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const settings = (cs?.settings as Record<string, unknown> | null) ?? {};
  const customRules = (settings.custom_rules as CustomRuleSettings[] | undefined) ?? [];
  const updated = customRules.filter((r) => r.id !== id);

  if (cs?.id) {
    await admin.from("clinic_settings").update({ settings: { ...settings, custom_rules: updated } }).eq("id", cs.id as string);
  }

  return NextResponse.json({ ok: true });
}
