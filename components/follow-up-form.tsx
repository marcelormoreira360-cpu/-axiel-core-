import type { Patient } from "@/lib/types";
import { Button } from "@/components/button";
import { MESSAGE_AUTOMATION_STATUS } from "@/modules/follow-ups/message-placeholder";

export function FollowUpForm({ patients, action }: { patients: Patient[]; action: (formData: FormData) => Promise<void> }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <p className="text-sm font-semibold text-black/75">Create reminder</p>
        <p className="mt-1 text-xs leading-5 text-black/45">Simple structure only. Nothing is sent automatically.</p>
      </div>

      <label className="block text-sm font-semibold text-black/65">
        Patient
        <select name="patient_id" required className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25">
          <option value="">Choose patient</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>{patient.full_name}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-semibold text-black/65">
        Reminder title
        <input name="title" defaultValue="Next session reminder" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-semibold text-black/65">
          Date
          <input name="date" type="date" required defaultValue={defaultDate} className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
        </label>
        <label className="block text-sm font-semibold text-black/65">
          Time
          <input name="time" type="time" required defaultValue="09:00" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25" />
        </label>
      </div>

      <label className="block text-sm font-semibold text-black/65">
        Message placeholder
        <select name="channel" className="mt-2 h-14 w-full rounded-2xl border border-axiel-line bg-white px-4 text-sm outline-none focus:border-black/25">
          <option value="none">No message</option>
          <option value="email">Email placeholder</option>
          <option value="sms">SMS placeholder</option>
        </select>
      </label>

      <label className="block text-sm font-semibold text-black/65">
        Notes
        <textarea name="notes" rows={3} placeholder="Optional internal note" className="mt-2 w-full rounded-2xl border border-axiel-line bg-white px-4 py-3 text-sm outline-none focus:border-black/25" />
      </label>

      <div className="rounded-3xl bg-axiel-soft p-4 text-xs leading-5 text-black/50">
        {MESSAGE_AUTOMATION_STATUS}
      </div>

      <Button className="min-h-14 w-full text-base">Create reminder</Button>
    </form>
  );
}
