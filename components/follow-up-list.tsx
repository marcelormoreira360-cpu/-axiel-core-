import { BellPlus, CheckCircle2, Clock, Mail, MessageSquare, XCircle } from "lucide-react";
import type { FollowUp } from "@/lib/types";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { ViewDetails } from "@/components/view-details";
import { MESSAGE_AUTOMATION_STATUS } from "@/modules/follow-ups/message-placeholder";

function ChannelIcon({ channel }: { channel: FollowUp["channel"] }) {
  if (channel === "email") return <Mail className="h-4 w-4" />;
  if (channel === "sms") return <MessageSquare className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

function statusLabel(status: FollowUp["status"]) {
  if (status === "completed") return "Concluído";
  if (status === "canceled") return "Cancelado";
  return "Pendente";
}

export function FollowUpList({
  followUps,
  completeAction,
  cancelAction,
  sendAction,
}: {
  followUps: FollowUp[];
  completeAction: (formData: FormData) => Promise<void>;
  cancelAction: (formData: FormData) => Promise<void>;
  sendAction?: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="space-y-3">
      {followUps.slice(0, 5).map((followUp) => (
        <div key={followUp.id} className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-axiel-soft px-3 py-1 text-xs font-semibold text-black/55">{statusLabel(followUp.status)}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-black/45 ring-1 ring-axiel-line">
                  <ChannelIcon channel={followUp.channel} /> {followUp.channel === "none" ? "Só lembrete" : followUp.channel.toUpperCase()}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight">{followUp.title}</h3>
              <p className="mt-1 text-sm text-black/55">{followUp.patients?.full_name ?? "Paciente"} · {new Date(followUp.due_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
              {followUp.notes && <p className="mt-3 text-sm leading-6 text-black/60">{followUp.notes}</p>}
              {followUp.ai_suggested_timing && (
                <p className="mt-3 rounded-3xl bg-axiel-soft p-3 text-xs leading-5 text-black/50">{followUp.ai_suggested_timing}</p>
              )}
              {followUp.channel !== "none" && (
                <p className="mt-3 text-xs text-black/40">{MESSAGE_AUTOMATION_STATUS}</p>
              )}
            </div>

            {followUp.status === "pending" && (
              <div className="flex shrink-0 flex-wrap gap-2">

                {sendAction && followUp.channel !== "none" && (
                  <form action={sendAction}>
                    <input type="hidden" name="return_to" value="/follow-ups" />
                    <input type="hidden" name="follow_up_id" value={followUp.id} />
                    <input type="hidden" name="patient_id" value={followUp.patient_id} />
                    <input type="hidden" name="appointment_id" value={followUp.appointment_id ?? ""} />
                    <input type="hidden" name="channel" value={followUp.channel} />
                    <input type="hidden" name="use_case" value="follow_up" />
                    <input type="hidden" name="recipient" value={followUp.channel === "email" ? followUp.patients?.email ?? "" : followUp.patients?.phone ?? ""} />
                    <input type="hidden" name="subject" value={followUp.message_subject ?? ""} />
                    <input type="hidden" name="body" value={followUp.message_body ?? ""} />
                    <Button variant="secondary" className="min-h-12 gap-2">
                      {followUp.channel === "email" ? <Mail className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />} Enviar
                    </Button>
                  </form>
                )}
                <form action={completeAction}>
                  <input type="hidden" name="id" value={followUp.id} />
                  <Button variant="secondary" className="min-h-12 gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Concluir
                  </Button>
                </form>
                <form action={cancelAction}>
                  <input type="hidden" name="id" value={followUp.id} />
                  <Button variant="ghost" className="min-h-12 gap-2">
                    <XCircle className="h-4 w-4" /> Cancelar
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      ))}
      {followUps.length > 5 ? (
        <ViewDetails label={`Ver mais ${followUps.length - 5} acompanhamentos`}>
          <div className="space-y-3">
            {followUps.slice(5).map((followUp) => (
              <div key={followUp.id} className="rounded-xl border border-axiel-line bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <h3 className="text-xl font-semibold tracking-tight">{followUp.title}</h3>
                <p className="mt-1 text-sm text-black/55">{followUp.patients?.full_name ?? "Paciente"} · {new Date(followUp.due_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
              </div>
            ))}
          </div>
        </ViewDetails>
      ) : null}
      {followUps.length === 0 && (
        <EmptyState
          icon={<BellPlus className="h-7 w-7" />}
          title="Nenhum acompanhamento ainda"
          text="Nenhum lembrete criado. Crie um para que o paciente sempre saiba o próximo passo."
          href="/follow-ups"
          action="Criar lembrete"
        />
      )}
    </div>
  );
}
