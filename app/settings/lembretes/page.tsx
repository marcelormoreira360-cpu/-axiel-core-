import { redirect } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, CheckCircle2, XCircle } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getCurrentClinic } from "@/services/clinic-service";
import { toggleReminderAction } from "./actions";
import { PushSettingsToggle } from "@/components/push-prompt";

type CommunicationLog = {
  id: string;
  created_at: string;
  channel: string;
  use_case: string;
  status: string;
  patients: { full_name: string } | null;
};

const USE_CASE_KEYS: Record<string, string> = {
  appointment_confirmation: "ucConfirmation",
  appointment_reminder:     "ucReminder",
  follow_up:                "ucFollowUp",
  package_low:              "ucPackageLow",
};

type ReminderRow = {
  key: string;
  settingKey: string;
  labelKey: string;
  descKey: string;
  channels: string[];
  alwaysOn?: boolean;
};

const REMINDER_ROWS: ReminderRow[] = [
  { key: "confirmation", settingKey: "confirmation", labelKey: "rowConfirmationLabel", descKey: "rowConfirmationDesc", channels: ["whatsapp", "email"], alwaysOn: true },
  { key: "d-1", settingKey: "d_minus_1", labelKey: "rowD1Label", descKey: "rowD1Desc", channels: ["whatsapp", "email"] },
  { key: "d+3", settingKey: "d_plus_3", labelKey: "rowD3Label", descKey: "rowD3Desc", channels: ["whatsapp"] },
  { key: "d+30", settingKey: "d_plus_30", labelKey: "rowD30Label", descKey: "rowD30Desc", channels: ["whatsapp"] },
];

export default async function LembretesPage() {
  const t = await getTranslations("settings.lembretes");
  const locale = await getLocale();
  const clinic = await getCurrentClinic();
  if (!clinic) redirect("/dashboard");

  const supabase = await createSupabaseServerClient();
  const clinicId = clinic.id;

  // Load clinic reminder settings
  const { data: cs } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const reminderSettings = (cs?.settings as Record<string, unknown> | null)?.reminders as Record<string, boolean> | undefined;
  const isEnabled = (key: string) => reminderSettings ? (reminderSettings[key] !== false) : true;

  // Load last 20 communication logs
  const { data: logs } = await supabase
    .from("communication_logs")
    .select("*, patients(full_name)")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(20);

  const typedLogs = (logs ?? []) as CommunicationLog[];

  return (
    <Shell>
      <div className="max-w-2xl">
        {/* Back link */}
        <BackLink
          fallbackHref="/settings"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-black/45 hover:text-[#0F1A2E] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
        </BackLink>

        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] text-[#A09E98] tracking-[.04em] uppercase mb-1">{t("eyebrow")}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#0F1A2E]">{t("title")}</h1>
          <p className="mt-2 text-sm text-black/55">
            {t("subtitle")}
          </p>
        </div>

        {/* Pipeline card */}
        <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px] mb-6">
          <p className="text-[10px] text-[#A09E98] tracking-[.04em] uppercase mb-4">{t("pipelineTitle")}</p>

          <div className="space-y-0">
            {REMINDER_ROWS.map((row, idx) => {
              const enabled = row.alwaysOn ? true : isEnabled(row.settingKey);

              return (
                <div key={row.key}>
                  {/* Connector line */}
                  {idx > 0 && (
                    <div className="flex items-center gap-3 py-1 pl-[19px]">
                      <div className="w-px h-4 bg-black/10 ml-[3px]" />
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    {/* Step indicator */}
                    <div
                      className={`mt-0.5 h-[26px] w-[26px] shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-semibold ${
                        enabled
                          ? "border-[#0F6E56] bg-[#E1F5EE] text-[#0F6E56]"
                          : "border-black/15 bg-black/[.03] text-black/30"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    <div className="flex-1 flex items-start justify-between gap-4 py-1">
                      <div>
                        <p className={`text-sm font-medium ${enabled ? "text-[#0F1A2E]" : "text-black/35"}`}>
                          {t(row.labelKey)}
                        </p>
                        <p className="text-xs text-black/45 mt-0.5">{t(row.descKey)}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {row.channels.includes("whatsapp") && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-black/45 bg-black/[.04] rounded-full px-2 py-0.5">
                              <MessageCircle className="h-2.5 w-2.5" /> {t("whatsapp")}
                            </span>
                          )}
                          {row.channels.includes("email") && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-black/45 bg-black/[.04] rounded-full px-2 py-0.5">
                              <Mail className="h-2.5 w-2.5" /> {t("email")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Toggle or always-on badge */}
                      {row.alwaysOn ? (
                        <span className="shrink-0 text-[10px] text-[#0F6E56] bg-[#E1F5EE] px-2 py-1 rounded-full font-medium whitespace-nowrap">
                          {t("alwaysOn")}
                        </span>
                      ) : (
                        <div className="shrink-0 flex items-center gap-2">
                          {/* Toggle off (disable) */}
                          {enabled && (
                            <form action={toggleReminderAction}>
                              <input type="hidden" name="key" value={row.settingKey} />
                              <input type="hidden" name="enabled" value="false" />
                              <button
                                type="submit"
                                className="relative inline-flex h-5 w-9 cursor-pointer rounded-full bg-[#0F6E56] transition-colors focus:outline-none"
                                aria-label={t("disableAria", { label: t(row.labelKey) })}
                              >
                                <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" />
                              </button>
                            </form>
                          )}
                          {/* Toggle on (enable) */}
                          {!enabled && (
                            <form action={toggleReminderAction}>
                              <input type="hidden" name="key" value={row.settingKey} />
                              <input type="hidden" name="enabled" value="true" />
                              <button
                                type="submit"
                                className="relative inline-flex h-5 w-9 cursor-pointer rounded-full bg-black/15 transition-colors focus:outline-none"
                                aria-label={t("enableAria", { label: t(row.labelKey) })}
                              >
                                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform" />
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Communications log */}
        <div className="bg-white border border-black/[.07] rounded-[12px] p-[15px]">
          <p className="text-[10px] text-[#A09E98] tracking-[.04em] uppercase mb-4">{t("logTitle")}</p>

          {typedLogs.length === 0 ? (
            <p className="text-sm text-black/40 py-4 text-center">{t("logEmpty")}</p>
          ) : (
            <div className="space-y-0 divide-y divide-black/[.05]">
              {typedLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2.5">
                  {/* Channel icon */}
                  <div className="shrink-0 text-black/30">
                    {log.channel === "email" ? (
                      <Mail className="h-3.5 w-3.5" />
                    ) : (
                      <MessageCircle className="h-3.5 w-3.5" />
                    )}
                  </div>

                  {/* Patient + use_case */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#0F1A2E] truncate">
                      {log.patients?.full_name ?? "—"}
                    </p>
                    <p className="text-[11px] text-black/40 truncate">{USE_CASE_KEYS[log.use_case] ? t(USE_CASE_KEYS[log.use_case]) : log.use_case}</p>
                  </div>

                  {/* Status badge */}
                  <div className="shrink-0">
                    {log.status === "sent" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-[#0F6E56] bg-[#E1F5EE] px-2 py-0.5 rounded-full font-medium">
                        <CheckCircle2 className="h-2.5 w-2.5" /> {t("statusSent")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-medium">
                        <XCircle className="h-2.5 w-2.5" /> {t("statusFailed")}
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="shrink-0 text-[11px] text-black/35 tabular-nums w-[72px] text-right">
                    {new Date(log.created_at).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" })}
                    {" "}
                    {new Date(log.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Push notification toggle */}
        <div className="mt-8 rounded-2xl border border-black/[.07] bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 mb-1">
            {t("pushTitle")}
          </p>
          <p className="text-[12px] text-black/45 mb-4">
            {t("pushDesc")}
          </p>
          <PushSettingsToggle />
        </div>
      </div>
    </Shell>
  );
}
