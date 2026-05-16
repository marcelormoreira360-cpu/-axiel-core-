import { Mail, MessageSquare, ShieldCheck, Wand2 } from "lucide-react";
import { Shell } from "@/components/shell";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
import { CommunicationTemplateCard } from "@/components/communication-template-card";
import { CommunicationLogList } from "@/components/communication-log-list";
import { LimitedList } from "@/components/limited-list";
import { getCurrentUserProfile } from "@/services/user-service";
import { getCommunicationLogs, getCommunicationTemplates } from "@/services/communication-service";
import { installDefaultTemplatesAction, updateTemplateAction } from "./actions";

export default async function CommunicationsPage() {
  const profile = await getCurrentUserProfile();
  const [templates, logs] = await Promise.all([
    getCommunicationTemplates(profile?.clinic_id ?? undefined),
    getCommunicationLogs(profile?.clinic_id ?? undefined, 20),
  ]);

  const emailTemplates = templates.filter((template) => template.channel === "email");
  const smsTemplates = templates.filter((template) => template.channel === "sms");

  return (
    <Shell>
      <header className="mb-8 flex flex-col gap-5 pt-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium tracking-[0.22em] text-axiel-gold">COMMUNICATIONS</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Simple messages.</h1>
          <p className="mt-3 max-w-2xl text-black/55">Email and SMS for appointment reminders, follow-ups, and lead nurturing.</p>
        </div>
        <form action={installDefaultTemplatesAction}>
          <Button className="min-h-12">Create default templates</Button>
        </form>
      </header>

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <Card className="bg-axiel-ink p-6 text-white">
          <Mail className="h-5 w-5 text-white/45" />
          <p className="mt-3 text-sm text-white/55">Email templates</p>
          <p className="mt-2 text-4xl font-semibold">{emailTemplates.length}</p>
        </Card>
        <Card className="p-6">
          <MessageSquare className="h-5 w-5 text-black/30" />
          <p className="mt-3 text-sm text-black/45">SMS templates</p>
          <p className="mt-2 text-4xl font-semibold">{smsTemplates.length}</p>
        </Card>
        <Card className="p-6">
          <ShieldCheck className="h-5 w-5 text-black/30" />
          <p className="mt-3 text-sm text-black/45">Message safety</p>
          <p className="mt-2 text-xl font-semibold">Simple, non-medical</p>
          <p className="mt-1 text-xs leading-5 text-black/45">Templates should not include diagnosis, session, or prescription instructions.</p>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {templates.length === 0 ? (
            <EmptyState
              icon={<Wand2 className="h-7 w-7" />}
              title="No message templates yet"
              text="Create default templates to start with simple ready-to-edit messages."
              href="/communications"
              action="Create templates"
            />
          ) : (
            <LimitedList
              items={templates}
              detailsLabel={`View ${Math.max(templates.length - 5, 0)} more templates`}
              renderItem={(template) => <CommunicationTemplateCard key={template.id} template={template} updateAction={updateTemplateAction} />}
            />
          )}
        </div>
        <div>
          <h2 className="mb-4 text-2xl font-semibold tracking-tight">Recent messages</h2>
          <CommunicationLogList logs={logs} />
        </div>
      </section>
    </Shell>
  );
}
