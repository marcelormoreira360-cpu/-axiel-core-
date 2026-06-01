import type { Patient } from "@/lib/types";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/button";
import { MESSAGE_AUTOMATION_STATUS } from "@/modules/follow-ups/message-placeholder";
import { VoiceDictation } from "@/components/voice-dictation";

export async function FollowUpForm({ patients, action }: { patients: Patient[]; action: (formData: FormData) => Promise<void> }) {
  const t = await getTranslations("automations.followUpForm");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <p className="text-sm font-semibold text-black/75">{t("createTitle")}</p>
        <p className="mt-1 text-xs leading-5 text-black/45">{t("createSub")}</p>
      </div>

      <label className="block text-sm font-semibold text-black/65">
        {t("patient")}
        <select name="patient_id" required className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25">
          <option value="">{t("selectPatient")}</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>{patient.full_name}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-semibold text-black/65">
        {t("reminderTitle")}
        <input name="title" defaultValue={t("reminderTitleDefault")} className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold text-black/65">
          {t("date")}
          <input name="date" type="date" required defaultValue={defaultDate} className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
        </label>
        <label className="block text-sm font-semibold text-black/65">
          {t("time")}
          <input name="time" type="time" required defaultValue="09:00" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
        </label>
      </div>

      <label className="block text-sm font-semibold text-black/65">
        {t("msgTemplate")}
        <select name="channel" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25">
          <option value="none">{t("tplNone")}</option>
          <option value="email">{t("tplEmail")}</option>
          <option value="sms">{t("tplSms")}</option>
        </select>
      </label>

      <label className="block text-sm font-semibold text-black/65">
        {t("notes")}
        <VoiceDictation
          name="notes"
          placeholder={t("notesPlaceholder")}
          rows={3}
          textareaClassName="mt-2 w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 pr-8 text-sm outline-none focus:border-black/25"
        />
      </label>

      <div className="rounded-3xl bg-axiel-soft p-4 text-xs leading-5 text-black/50">
        {MESSAGE_AUTOMATION_STATUS}
      </div>

      <Button className="min-h-14 w-full text-base">{t("submit")}</Button>
    </form>
  );
}
