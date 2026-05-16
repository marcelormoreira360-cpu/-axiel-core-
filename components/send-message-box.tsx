import { Button } from "@/components/button";

export function SendMessageBox({
  title,
  helper,
  channel,
  recipient,
  subject,
  body,
  action,
  hiddenFields = {},
}: {
  title: string;
  helper: string;
  channel: "email" | "sms";
  recipient: string | null | undefined;
  subject?: string | null;
  body: string;
  action: (formData: FormData) => Promise<void>;
  hiddenFields?: Record<string, string | null | undefined>;
}) {
  return (
    <form action={action} className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm">
      {Object.entries(hiddenFields).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={value} /> : null)}
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="recipient" value={recipient ?? ""} />
      <input type="hidden" name="subject" value={subject ?? ""} />
      <input type="hidden" name="body" value={body} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 text-sm text-black/45">{helper}</p>
          <p className="mt-2 text-xs text-black/40">To: {recipient || `No ${channel === "email" ? "email" : "phone"} added`}</p>
        </div>
        <Button disabled={!recipient} className="min-h-12">Send {channel.toUpperCase()}</Button>
      </div>
      <div className="mt-4 rounded-2xl bg-axiel-soft p-4 text-sm leading-6 text-black/60">
        {subject && <p className="mb-2 font-semibold text-black/70">{subject}</p>}
        {body}
      </div>
    </form>
  );
}
