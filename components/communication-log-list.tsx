import { CheckCircle2, Mail, MessageSquare, Send, XCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { LimitedList } from "@/components/limited-list";

export function CommunicationLogList({ logs }: { logs: Array<Record<string, any>> }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={<Send className="h-7 w-7" />}
        title="No messages sent yet"
        text="Message history will appear here after you send your first email or SMS."
        href="/communications"
        action="Prepare messages"
      />
    );
  }

  return (
    <LimitedList
      items={logs}
      detailsLabel={`View ${Math.max(logs.length - 5, 0)} more messages`}
      renderItem={(log) => (
        <div key={log.id} className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-black/45">
                {log.channel === "email" ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                <span>{String(log.use_case).replaceAll("_", " ")}</span>
              </div>
              <p className="text-sm font-semibold">{log.recipient}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-black/45">{log.body}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-axiel-soft px-3 py-1 text-xs font-semibold text-black/55">
              {log.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {log.status}
            </span>
          </div>
          <p className="mt-2 text-xs text-black/35">{new Date(log.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
        </div>
      )}
    />
  );
}
