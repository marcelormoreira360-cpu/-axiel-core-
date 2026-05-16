import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { SimplePageHeader } from "@/components/simple-page-header";
import { createPatientAction } from "./actions";

export default function NewPatientPage() {
  return (
    <Shell>
      <SimplePageHeader eyebrow="NEW PATIENT" title="Add patient" helper="Only the information needed to start. You can add more later." />
      <Card className="max-w-2xl p-6">
        <form action={createPatientAction} className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">Full name
            <input name="full_name" required className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30" placeholder="Patient name" />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">Email
              <input name="email" type="email" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30" placeholder="email@example.com" />
            </label>
            <label className="grid gap-2 text-sm font-semibold">Phone
              <input name="phone" className="min-h-14 rounded-2xl border border-axiel-line bg-white px-4 text-base outline-none focus:border-black/30" placeholder="(000) 000-0000" />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold">Quick note
            <textarea name="notes" rows={4} className="rounded-2xl border border-axiel-line bg-white p-4 text-base outline-none focus:border-black/30" placeholder="Anything important to remember?" />
          </label>
          <div className="flex flex-wrap gap-3 pt-2">
            <button className="min-h-14 rounded-lg bg-axiel-blue px-7 text-base font-semibold text-white shadow-md" type="submit">Save patient</button>
            <Link href="/patients" className="inline-flex min-h-14 items-center rounded-lg border border-axiel-line bg-white px-7 text-base font-semibold">Cancel</Link>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
