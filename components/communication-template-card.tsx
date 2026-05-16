import { Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/button";
import type { CommunicationTemplate } from "@/services/communication-service";
import { communicationUseCaseLabels } from "@/modules/communications/templates";

function ChannelIcon({ channel }: { channel: CommunicationTemplate["channel"] }) {
  return channel === "email" ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />;
}

export function CommunicationTemplateCard({
  template,
  updateAction,
}: {
  template: CommunicationTemplate;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={updateAction} className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm">
      <input type="hidden" name="id" value={template.id} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-axiel-soft px-3 py-1 text-xs font-semibold text-black/55">
              <ChannelIcon channel={template.channel} /> {template.channel.toUpperCase()}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black/40 ring-1 ring-axiel-line">
              {communicationUseCaseLabels[template.use_case]}
            </span>
          </div>
          <h3 className="text-xl font-semibold tracking-tight">{template.name}</h3>
        </div>
        <Button variant="secondary" className="min-h-11">Save</Button>
      </div>

      {template.channel === "email" && (
        <label className="mb-3 block text-sm font-medium text-black/55">
          Subject
          <input
            name="subject"
            defaultValue={template.subject ?? ""}
            className="mt-2 w-full rounded-2xl border border-axiel-line bg-axiel-soft px-4 py-3 text-sm outline-none focus:border-black/25"
            placeholder="Simple subject"
          />
        </label>
      )}

      <label className="block text-sm font-medium text-black/55">
        Message
        <textarea
          name="body"
          defaultValue={template.body}
          rows={4}
          className="mt-2 w-full resize-none rounded-2xl border border-axiel-line bg-axiel-soft px-4 py-3 text-sm leading-6 outline-none focus:border-black/25"
        />
      </label>

      <p className="mt-3 text-xs leading-5 text-black/40">
        Available variables: {"{{name}}"}, {"{{date}}"}, {"{{time}}"}, {"{{duration}}"}, {"{{source}}"}.
      </p>
    </form>
  );
}
