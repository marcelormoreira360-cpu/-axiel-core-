import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Send, UserCheck, UserRound } from "lucide-react";
import { Shell } from "@/components/shell";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/card";
import { getLeadById } from "@/services/lead-service";
import { GuidedAiInsightsPanel } from "@/components/guided-ai-insights-panel";
import { ActionSuggestionsPanel } from "@/components/action-suggestions-panel";
import { getLeadProfileAiInsights } from "@/modules/ai-insights/contextual-placeholders";
import { getNextLeadAction, leadStageLabels } from "@/modules/leads/lead-pipeline";
import { buildActionSuggestions } from "@/modules/action-suggestions/action-rules";
import { getActionSuggestions, syncActionSuggestions } from "@/services/action-suggestion-service";
import { SendMessageBox } from "@/components/send-message-box";
import { sendManualCommunicationAction } from "@/app/communications/actions";
import { buildLeadVariables, defaultCommunicationTemplates, renderCommunicationTemplate } from "@/modules/communications/templates";
import { ConvertLeadButton } from "@/components/convert-lead-button";
import { convertLeadToPatientAction } from "@/app/leads/[id]/actions";
import { getTranslations } from "next-intl/server";

export default async function LeadProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("leads.profile");
  const lead = await getLeadById(id);

  if (!lead) notFound();

  const aiInsights = getLeadProfileAiInsights(lead);
  await syncActionSuggestions(buildActionSuggestions({
    clinicId: lead.clinic_id,
    patients: [],
    leads: [lead],
    appointments: [],
    followUps: [],
  }));
  const actionSuggestions = await getActionSuggestions({
    clinicId: lead.clinic_id,
    entityType: "lead",
    entityId: lead.id,
    status: ["pending", "accepted"],
    limit: 4,
  });

  const leadVariables = buildLeadVariables(lead);
  const leadEmailTemplate = defaultCommunicationTemplates.find((template) => template.key === "lead_nurturing_email")!;
  const leadSmsTemplate = defaultCommunicationTemplates.find((template) => template.key === "lead_nurturing_sms")!;
  const leadEmailBody = renderCommunicationTemplate(leadEmailTemplate.body, leadVariables);
  const leadSmsBody = renderCommunicationTemplate(leadSmsTemplate.body, leadVariables);

  return (
    <Shell>
      <header className="mb-8 pt-4">
        <BackLink fallbackHref="/leads" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium shadow-sm">
          <ArrowLeft className="h-4 w-4" /> {t("back")}
        </BackLink>
        <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold dark:text-[#9FE1CB]">{t("eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{lead.full_name}</h1>
            <p className="mt-3 text-black/55">{leadStageLabels[lead.stage]} · {lead.source}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {lead.converted_patient_id ? (
              <Link
                href={`/patients/${lead.converted_patient_id}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-6 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400 shadow-sm transition hover:-translate-y-0.5"
              >
                <UserCheck className="h-4 w-4" />
                {t("openPatient")}
              </Link>
            ) : (
              <ConvertLeadButton leadId={lead.id} action={convertLeadToPatientAction} />
            )}
            <div className="rounded-full bg-white px-5 py-3 text-center text-sm font-medium text-black/60 shadow-sm">{getNextLeadAction(lead)}</div>
          </div>
        </div>
      </header>

      {lead.converted_patient_id ? null : (
        <Card className="mb-4 flex flex-col gap-4 border-axiel-line bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-axiel-gold dark:text-[#9FE1CB]">{t("convertCard.eyebrow")}</p>
            <p className="mt-1 text-lg font-semibold tracking-tight">{t("convertCard.title")}</p>
            <p className="mt-1 text-sm text-black/50">{t("convertCard.helper")}</p>
          </div>
          <ConvertLeadButton leadId={lead.id} action={convertLeadToPatientAction} />
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-axiel-soft dark:bg-white/[.04]">
              <UserRound className="h-5 w-5 text-axiel-gold dark:text-[#9FE1CB]" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{t("contact.title")}</h2>
              <p className="text-sm text-black/50">{t("contact.helper")}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs uppercase tracking-[0.18em] text-black/35">{t("contact.name")}</p>
              <p className="mt-2 font-semibold">{lead.full_name}</p>
            </div>
            <div className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs uppercase tracking-[0.18em] text-black/35">{t("contact.phone")}</p>
              <p className="mt-2 flex items-center gap-2 font-semibold"><Phone className="h-4 w-4 text-black/35" /> {lead.phone || t("contact.notAdded")}</p>
            </div>
            <div className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs uppercase tracking-[0.18em] text-black/35">{t("contact.email")}</p>
              <p className="mt-2 flex items-center gap-2 font-semibold"><Mail className="h-4 w-4 text-black/35" /> {lead.email || t("contact.notAdded")}</p>
            </div>
            <div className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs uppercase tracking-[0.18em] text-black/35">{t("contact.source")}</p>
              <p className="mt-2 font-semibold capitalize">{lead.source}</p>
            </div>
            <div className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <p className="text-xs uppercase tracking-[0.18em] text-black/35">{t("contact.mainComplaint")}</p>
              <p className="mt-2 font-semibold">{lead.main_complaint || t("contact.notAdded")}</p>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <h2 className="text-2xl font-semibold tracking-tight">{t("notes.title")}</h2>
            <p className="mt-1 text-sm text-black/50">{t("notes.helper")}</p>
            <div className="mt-5 min-h-44 rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md leading-7 text-black/65">
              {lead.notes || t("notes.empty")}
            </div>
          </Card>

<ActionSuggestionsPanel title={t("nextSteps")} actions={actionSuggestions} />

          <Card className="p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-axiel-soft dark:bg-white/[.04]">
                <Send className="h-5 w-5 text-axiel-gold dark:text-[#9FE1CB]" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{t("send.title")}</h2>
                <p className="text-sm text-black/50">{t("send.helper")}</p>
              </div>
            </div>
            <div className="grid gap-3">
              <SendMessageBox
                title={t("send.emailTitle")}
                helper={t("send.emailHelper")}
                channel="email"
                recipient={lead.email}
                subject={leadEmailTemplate.subject}
                body={leadEmailBody}
                action={sendManualCommunicationAction}
                hiddenFields={{ lead_id: lead.id, use_case: "lead_nurturing", return_to: `/leads/${lead.id}` }}
              />
              <SendMessageBox
                title={t("send.smsTitle")}
                helper={t("send.smsHelper")}
                channel="sms"
                recipient={lead.phone}
                body={leadSmsBody}
                action={sendManualCommunicationAction}
                hiddenFields={{ lead_id: lead.id, use_case: "lead_nurturing", return_to: `/leads/${lead.id}` }}
              />
            </div>
          </Card>


          <GuidedAiInsightsPanel title={t("aiTitle")} {...aiInsights} compact />
        </div>
      </section>
    </Shell>
  );
}
