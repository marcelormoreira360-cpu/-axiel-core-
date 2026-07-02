import { redirect } from "next/navigation";
import { Bell, CalendarClock, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { FollowUpForm } from "@/components/follow-up-form";
import { FollowUpList } from "@/components/follow-up-list";
import { getPatients } from "@/services/patient-service";
import { createFollowUp, getFollowUps, updateFollowUpStatus } from "@/services/follow-up-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { buildFollowUpMessagePlaceholder } from "@/modules/follow-ups/message-placeholder";
import { FOLLOW_UP_AI_LABEL, getFollowUpReviewPrompts, getSuggestedFollowUpTimingPlaceholder } from "@/modules/follow-ups/ai-placeholder";
import type { FollowUpChannel } from "@/lib/types";
import { sendManualCommunicationAction } from "@/app/communications/actions";

export default async function FollowUpsPage() {
  const t = await getTranslations("automations.followUps");
  const [profile, patients, followUps] = await Promise.all([getCurrentUserProfile(), getPatients(), getFollowUps()]);
  const pending = followUps.filter((item) => item.status === "pending");
  const completed = followUps.filter((item) => item.status === "completed");
  const reviewPrompts = getFollowUpReviewPrompts();

  async function createFollowUpAction(formData: FormData) {
    "use server";

    const profile = await getCurrentUserProfile();
    if (!profile?.clinic_id) throw new Error("User must be assigned to a clinic before creating follow-ups.");

    const patientId = String(formData.get("patient_id") ?? "");
    const title = String(formData.get("title") ?? "Next session reminder").trim() || "Next session reminder";
    const date = String(formData.get("date") ?? "");
    const time = String(formData.get("time") ?? "");
    const channel = String(formData.get("channel") ?? "none") as FollowUpChannel;
    const notes = String(formData.get("notes") ?? "").trim() || null;

    if (!patientId || !date || !time) throw new Error("Patient, date, and time are required.");

    const patients = await getPatients();
    const followUps = await getFollowUps();
    const patient = patients.find((item) => item.id === patientId);
    if (!patient) throw new Error("Patient not found or not available for this clinic.");

    const message = buildFollowUpMessagePlaceholder(patient, channel);
    const aiSuggestedTiming = getSuggestedFollowUpTimingPlaceholder({
      patient,
      followUps: followUps.filter((item) => item.patient_id === patientId),
    });

    await createFollowUp({
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      title,
      due_at: new Date(`${date}T${time}:00`).toISOString(),
      channel,
      message_subject: message.subject,
      message_body: message.body,
      notes,
      ai_suggested_timing: aiSuggestedTiming,
    });

    redirect("/follow-ups");
  }

  async function completeFollowUpAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Follow-up ID is required.");
    await updateFollowUpStatus(id, "completed");
    redirect("/follow-ups");
  }

  async function cancelFollowUpAction(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) throw new Error("Follow-up ID is required.");
    await updateFollowUpStatus(id, "canceled");
    redirect("/follow-ups");
  }

  return (
    <Shell>
      <header className="mb-8 flex flex-col gap-5 pt-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">{t("eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{t("title")}</h1>
          <p className="mt-3 max-w-2xl text-black/55 dark:text-white/55">{t("subtitle")}</p>
        </div>
      </header>

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <Card className="bg-axiel-ink p-6 text-white">
          <Bell className="h-5 w-5 text-white/45" />
          <p className="mt-3 text-sm text-white/55">{t("kpiPending")}</p>
          <p className="mt-2 text-4xl font-semibold">{pending.length}</p>
        </Card>
        <Card className="p-6">
          <CalendarClock className="h-5 w-5 text-black/30 dark:text-white/30" />
          <p className="mt-3 text-sm text-black/45 dark:text-white/45">{t("kpiCompleted")}</p>
          <p className="mt-2 text-4xl font-semibold">{completed.length}</p>
        </Card>
        <Card className="p-6">
          <Sparkles className="h-5 w-5 text-black/30 dark:text-white/30" />
          <p className="mt-3 text-sm text-black/45 dark:text-white/45">{t("kpiAi")}</p>
          <p className="mt-2 text-2xl font-semibold">{t("kpiTiming")}</p>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">{t("listTitle")}</h2>
            <p className="text-sm text-black/40 dark:text-white/40">{t("manualReview")}</p>
          </div>
          <FollowUpList followUps={followUps} completeAction={completeFollowUpAction} cancelAction={cancelFollowUpAction} sendAction={sendManualCommunicationAction} />
        </div>

        <div className="space-y-5">
          {!profile?.clinic_id ? (
            <Card>{t("noClinic")}</Card>
          ) : patients.length === 0 ? (
            <Card>{t("noPatients")}</Card>
          ) : (
            <FollowUpForm patients={patients} action={createFollowUpAction} />
          )}

          <Card className="bg-white dark:bg-[#111827]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white dark:bg-[#111827]">
                <Sparkles className="h-5 w-5 text-axiel-gold" />
              </div>
              <div>
                <h2 className="font-semibold">{FOLLOW_UP_AI_LABEL}</h2>
                <p className="text-xs text-black/45 dark:text-white/45">{t("aiTimingSub")}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {reviewPrompts.map((prompt) => (
                <p key={prompt} className="rounded-xl border border-axiel-line bg-white dark:bg-[#111827] p-6 shadow-sm text-sm leading-5 text-black/55 dark:text-white/55">{prompt}</p>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </Shell>
  );
}
