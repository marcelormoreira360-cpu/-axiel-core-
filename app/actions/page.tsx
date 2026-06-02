import { CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { ActionSuggestionCard } from "@/components/action-suggestion-card";
import { EmptyState } from "@/components/empty-state";
import { LimitedList } from "@/components/limited-list";
import { getCurrentClinic } from "@/services/clinic-service";
import { getPatients } from "@/services/patient-service";
import { getLeads } from "@/services/lead-service";
import { getAppointments } from "@/services/appointment-service";
import { getPendingFollowUps } from "@/services/follow-up-service";
import { getActionSuggestions, syncActionSuggestions } from "@/services/action-suggestion-service";
import { buildActionSuggestions } from "@/modules/action-suggestions/action-rules";

export default async function ActionsPage() {
  const t = await getTranslations("actions");
  const clinic = await getCurrentClinic();

  if (clinic) {
    const [patients, leads, appointments, followUps] = await Promise.all([getPatients(), getLeads(), getAppointments(), getPendingFollowUps()]);
    await syncActionSuggestions(buildActionSuggestions({ clinicId: clinic.id, patients, leads, appointments, followUps }));
  }

  const actions = await getActionSuggestions({ clinicId: clinic?.id, status: ["pending", "accepted", "completed", "ignored"], limit: 50 });
  const active = actions.filter((action) => action.status === "pending" || action.status === "accepted");
  const completed = actions.filter((action) => action.status === "completed" || action.status === "ignored");

  return (
    <Shell>
      <header className="mb-6 pt-2">
        <p className="text-xs font-semibold tracking-[0.24em] text-axiel-gold">{t("eyebrow")}</p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight md:text-6xl">{t("title")}</h1>
        <p className="mt-3 text-lg text-black/55">{t("subtitle")}</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{t("activeTitle")}</h2>
          <LimitedList items={active} detailsLabel={t("viewMoreActive", { count: Math.max(active.length - 5, 0) })} renderItem={(action) => <ActionSuggestionCard key={action.id} action={action} />} />
          {active.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title={t("emptyActiveTitle")} text={t("emptyActiveText")} href="/dashboard" action={t("goToDashboard")} /> : null}
        </div>

        <div className="grid content-start gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{t("closedTitle")}</h2>
          <LimitedList items={completed} detailsLabel={t("viewMoreClosed", { count: Math.max(completed.length - 5, 0) })} renderItem={(action) => <ActionSuggestionCard key={action.id} action={action} compact />} />
          {completed.length === 0 ? <div className="rounded-[1.5rem] bg-axiel-soft p-5 text-sm text-black/55">{t("completedHint")}</div> : null}
        </div>
      </section>
    </Shell>
  );
}
