import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { BigAction } from "@/components/big-action";
import { Building2, CalendarPlus, ClipboardList, UserPlus, UsersRound } from "lucide-react";

const steps = [
  { title: "Guided onboarding", text: "Set up the clinic, forms, hours, staff, and sample data.", href: "/onboarding", icon: Building2 },
  { title: "Add first patient", text: "Create one clean patient record.", href: "/patients/new", icon: UserPlus },
  { title: "Add first lead", text: "Start the CRM pipeline.", href: "/leads/new", icon: UsersRound },
  { title: "Book first session", text: "Place a patient on the calendar.", href: "/schedule/new", icon: CalendarPlus },
  { title: "Prepare intake", text: "Customize simple questions.", href: "/intake", icon: ClipboardList },
];

export default function GetStartedPage() {
  return (
    <Shell>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-black/35">Setup</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Get started in minutes</h1>
        <p className="mt-3 max-w-2xl text-lg text-black/55">Follow these steps once. After that, most users will live inside Home, Patients, Leads, and Schedule.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <BigAction key={step.href} href={step.href} icon={step.icon} title={`${index + 1}. ${step.title}`} helper={step.text} />
        ))}
      </div>

      <Card className="mt-6 p-6">
        <h2 className="text-xl font-semibold">SaaS readiness note</h2>
        <p className="mt-2 text-sm leading-6 text-black/55">Security, audit logs, billing foundation, feature flags, and stronger clinic isolation are now structured. Payment processing and real automated messaging are intentionally still placeholders.</p>
      </Card>
    </Shell>
  );
}
