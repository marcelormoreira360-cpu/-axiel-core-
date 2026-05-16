import { CheckCircle2 } from "lucide-react";
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
        <p className="text-xs font-semibold tracking-[0.24em] text-axiel-gold">ACTION CENTER</p>
        <h1 className="mt-2 text-5xl font-semibold tracking-tight md:text-6xl">What to do next</h1>
        <p className="mt-3 text-lg text-black/55">A simple list of actions the system suggests for the clinic.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Active actions</h2>
          <LimitedList items={active} detailsLabel={`View ${Math.max(active.length - 5, 0)} more active actions`} renderItem={(action) => <ActionSuggestionCard key={action.id} action={action} />} />
          {active.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title="No actions right now" text="Everything looks clear. AXIEL will suggest the next step when a patient, lead, review, or follow-up needs attention." href="/dashboard" action="Go to dashboard" /> : null}
        </div>

        <div className="grid content-start gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Recently closed</h2>
          <LimitedList items={completed} detailsLabel={`View ${Math.max(completed.length - 5, 0)} more closed actions`} renderItem={(action) => <ActionSuggestionCard key={action.id} action={action} compact />} />
          {completed.length === 0 ? <div className="rounded-[1.5rem] bg-axiel-soft p-5 text-sm text-black/55">Completed actions will appear here.</div> : null}
        </div>
      </section>
    </Shell>
  );
}
