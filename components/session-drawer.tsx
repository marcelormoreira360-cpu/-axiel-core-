"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { X, User, FileText, CalendarDays, Video, Check, LogIn, CheckCheck, UserX, Ban } from "lucide-react";
import type { ScheduleSession } from "@/components/session-card";
import { formatTime } from "@/modules/schedule/date-utils";
import {
  getStaffQuickActions,
  staffActionToRequested,
  SENSITIVE_STAFF_ACTIONS,
  classifyCancellationByWindow,
  DEFAULT_CANCELLATION_WINDOW_HOURS,
  type StaffQuickAction,
} from "@/modules/schedule/status-actions";

// Aparência de cada ação rápida da equipe (rótulo vem do i18n via actionKey).
const ACTION_META: Record<
  StaffQuickAction,
  { actionKey: string; Icon: typeof Check; cls: string }
> = {
  confirm:  { actionKey: "actionConfirm",  Icon: Check,     cls: "border-[#2D8CFF]/30 text-[#2563EB] hover:bg-[#EFF6FF]" },
  check_in: { actionKey: "actionCheckIn",  Icon: LogIn,     cls: "border-[#2A7BC1]/30 text-[#2A7BC1] hover:bg-[#EAF3FB]" },
  complete: { actionKey: "actionComplete", Icon: CheckCheck, cls: "border-[#0F6E56]/30 text-[#0F6E56] hover:bg-[#E1F5EE]" },
  no_show:  { actionKey: "actionNoShow",   Icon: UserX,     cls: "border-amber-200 text-amber-600 hover:bg-amber-50" },
  cancel:   { actionKey: "actionCancel",   Icon: Ban,       cls: "border-red-200 text-red-500 hover:bg-red-50" },
};

const STATUS_BADGE_CLS: Record<string, string> = {
  scheduled: "bg-[#F4F3EF] dark:bg-white/[.06] text-[#6B6A66] dark:text-[#9E9C97]",
  confirmed: "bg-[#EFF6FF] text-[#2563EB]",
  completed: "bg-[#E1F5EE] text-[#0F6E56]",
  cancelled: "bg-red-50 text-red-500",
  cancelled_notice: "bg-red-50 text-red-500",
  late_cancel: "bg-red-100 text-red-600",
  no_show:   "bg-amber-50 text-amber-600",
  checked_in: "bg-[#EAF3FB] text-[#2A7BC1]",
};

function initials(name: string) {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function SessionDrawer({
  session,
  onClose,
  updateStatusAction,
  cancellationWindowHours = DEFAULT_CANCELLATION_WINDOW_HOURS,
  enriching = false,
}: {
  session: ScheduleSession | null;
  onClose: () => void;
  updateStatusAction?: (id: string, status: string) => Promise<{ error?: string }>;
  /** Janela (horas) da clínica p/ classificar cancelamento (com aviso × tardio). */
  cancellationWindowHours?: number;
  /** true enquanto o ScheduleSession é enriquecido sob demanda (abertura na Semana). */
  enriching?: boolean;
}) {
  const t = useTranslations("schedule.drawer");
  const tStatus = useTranslations("common.appointmentStatus");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  // Ação sensível aguardando confirmação (no_show | cancel), ou null.
  const [pendingAction, setPendingAction] = useState<StaffQuickAction | null>(null);

  if (!session) return null;

  const patientName = session.patients?.full_name ?? t("patientFallback");
  const sessionCount = session.previousSessions.length + 1;
  const currentStatus = optimisticStatus ?? session.status ?? "scheduled";
  const badgeCls = STATUS_BADGE_CLS[currentStatus] ?? STATUS_BADGE_CLS.scheduled;
  const availableActions = getStaffQuickActions(currentStatus);

  // Prévia de como a REGRA classificará o cancelamento pela janela da clínica.
  // O servidor é a fonte de verdade; isto é só orientação para a equipe.
  const cancelKind =
    session.starts_at &&
    classifyCancellationByWindow(session.starts_at, cancellationWindowHours);

  function applyAction(action: StaffQuickAction) {
    if (!updateStatusAction || !session) return;
    const newStatus = staffActionToRequested(action);
    // Guarda o status real (do servidor) para reverter o otimismo em caso de erro.
    const previousStatus = optimisticStatus;
    // Otimismo: para 'cancel' usa a classificação da janela; para os demais, o alvo direto.
    const optimistic = action === "cancel" ? cancelKind || newStatus : newStatus;
    setOptimisticStatus(optimistic);
    startTransition(async () => {
      const res = await updateStatusAction!(session.id, newStatus);
      if (res?.error) {
        setOptimisticStatus(previousStatus);
        toast.error(res.error);
        return;
      }
      toast.success(t(`toast.${action}`));
      router.refresh();
    });
  }

  function onActionClick(action: StaffQuickAction) {
    // Ações sensíveis (marcar falta, cancelar) passam por um diálogo de confirmação.
    if (SENSITIVE_STAFF_ACTIONS.includes(action)) {
      setPendingAction(action);
      return;
    }
    applyAction(action);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 bg-[#0F1A2E]/20 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <aside className="relative w-full max-w-[380px] h-full bg-white dark:bg-[#111827] border-l border-black/[.07] dark:border-white/[.07] shadow-xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="px-[20px] pt-[20px] pb-[16px] border-b border-black/[.07] dark:border-white/[.07]">
          <div className="flex items-start justify-between gap-3 mb-[14px]">
            <p className="text-[10px] font-medium tracking-[.10em] uppercase text-[#A09E98]">{t("title")}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] dark:border-white/[.08] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Patient */}
          <div className="flex items-center gap-[12px]">
            <div className="w-11 h-11 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[14px] font-medium text-[#0F6E56] shrink-0">
              {initials(patientName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[16px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2] tracking-[-0.02em]">{patientName}</p>
                <span className={`text-[10px] font-medium px-[7px] py-[2px] rounded-full ${badgeCls}`}>
                  {tStatus(currentStatus)}
                </span>
              </div>
              <p className="text-[12px] text-[#A09E98] mt-[1px]">
                {enriching
                  ? t("metaNoCount", { time: formatTime(session.starts_at, locale), minutes: session.duration_minutes })
                  : t("meta", { count: sessionCount, time: formatTime(session.starts_at, locale), minutes: session.duration_minutes })}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-[20px] py-[16px] space-y-[12px]">
          {/* Notes preview */}
          {session.notes && (
            <div className="bg-[#FAFAF8] dark:bg-white/[.03] border border-black/[.06] dark:border-white/[.06] rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[10px] font-medium text-[#A09E98] mb-[4px]">{t("noteTitle")}</p>
              <p className="text-[12px] text-[#0F1A2E] dark:text-[#E8E6E2] leading-relaxed line-clamp-3">{session.notes}</p>
            </div>
          )}

          {/* Enquanto enriquece (abertura na visão Semana): loading das seções ricas.
              Não mostramos histórico/insight ainda para não exibir dado incompleto. */}
          {enriching && (
            <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[10px] px-[12px] py-[10px]">
              <div className="flex items-center gap-[8px]">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-[#0F6E56]/30 border-t-[#0F6E56] animate-spin" />
                <p className="text-[11px] text-[#A09E98]">{t("loadingHistory")}</p>
              </div>
              <div className="mt-[10px] space-y-[6px]">
                <div className="h-[10px] rounded bg-[#F4F3EF] dark:bg-white/[.06] animate-pulse w-3/4" />
                <div className="h-[10px] rounded bg-[#F4F3EF] dark:bg-white/[.06] animate-pulse w-1/2" />
              </div>
            </div>
          )}

          {/* Previous sessions */}
          {!enriching && session.previousSessions.length > 0 && (
            <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[10px] font-medium text-[#A09E98] mb-[8px]">{t("prevSessions")}</p>
              <div className="space-y-[6px]">
                {session.previousSessions.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-[11px] text-[#6B6A66] dark:text-[#9E9C97]">
                      {new Date(item.starts_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    </span>
                    <span className="text-[11px] text-[#A09E98]">{t("minutes", { count: item.duration_minutes })}</span>
                  </div>
                ))}
                {session.previousSessions.length > 4 && (
                  <p className="text-[10px] text-[#D3D1C7]">{t("morePrev", { count: session.previousSessions.length - 4 })}</p>
                )}
              </div>
            </div>
          )}

          {!enriching && session.previousSessions.length === 0 && (
            <div className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[11px] text-[#D3D1C7]">{t("firstSession")}</p>
            </div>
          )}

          {/* AI insight */}
          {!enriching && session.snapshot?.latest_insight_summary && session.snapshot.latest_insight_status !== "Not ready" && (
            <div className="bg-[#F0FAF6] dark:bg-[#0F6E56]/[.12] border border-[#0F6E56]/15 rounded-[10px] px-[12px] py-[10px]">
              <p className="text-[10px] font-medium text-[#0F6E56] mb-[4px]">{t("latestInsight")}</p>
              <p className="text-[11px] text-[#085041] dark:text-[#9FE1CB] leading-relaxed line-clamp-4">
                {session.snapshot.latest_insight_summary}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-[20px] pb-[20px] pt-[4px] space-y-[8px] border-t border-black/[.07] dark:border-white/[.07]">

          {/* Menu de ações de status (reflete as transições válidas do status atual) */}
          {updateStatusAction && availableActions.length > 0 && (
            <div>
              <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[6px]">
                {t("statusSection")}
              </p>
              <div className="flex gap-[6px] flex-wrap">
                {availableActions.map((action) => {
                  const meta = ACTION_META[action];
                  const Icon = meta.Icon;
                  return (
                    <button
                      key={action}
                      type="button"
                      onClick={() => onActionClick(action)}
                      disabled={isPending}
                      className={`flex items-center justify-center gap-[5px] flex-1 min-w-[92px] text-[11px] font-medium border rounded-[7px] px-[8px] py-[7px] transition disabled:opacity-50 ${meta.cls}`}
                    >
                      {isPending ? (
                        "…"
                      ) : (
                        <>
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          {t(meta.actionKey)}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {currentStatus === "completed" && (
            <div className="flex items-center justify-center gap-[6px] bg-[#E1F5EE] rounded-[8px] py-[8px]">
              <svg className="w-3.5 h-3.5 text-[#0F6E56]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span className="text-[12px] font-medium text-[#0F6E56]">{t("completed")}</span>
            </div>
          )}

          {/* Teleconsulta — generic video_url or Daily.co room */}
          {session.video_url || session.zoom_join_url ? (
            <a
              href={session.video_url ?? session.zoom_join_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-white bg-[#2A7BC1] hover:bg-[#1e6aad] transition px-[14px] py-[10px] rounded-[8px]"
            >
              <Video className="h-3.5 w-3.5" />
              {t("joinTelehealth")}
            </a>
          ) : (
            <Link
              href={`/schedule/${session.id}/telehealth`}
              onClick={onClose}
              className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-[#2A7BC1] border border-[#2A7BC1]/30 hover:bg-[#EAF3FB] transition px-[14px] py-[10px] rounded-[8px]"
            >
              <Video className="h-3.5 w-3.5" />
              {t("startTelehealth")}
            </Link>
          )}

          <Link
            href={`/schedule/${session.id}/session`}
            onClick={onClose}
            className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[10px] rounded-[8px]"
          >
            <FileText className="h-3.5 w-3.5" />
            {t("registerSession")}
          </Link>
          <Link
            href={`/patients/${session.patient_id}`}
            onClick={onClose}
            className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition px-[14px] py-[10px] rounded-[8px]"
          >
            <User className="h-3.5 w-3.5" />
            {t("viewProfile")}
          </Link>
          <Link
            href="/follow-ups"
            onClick={onClose}
            className="flex items-center justify-center gap-[6px] w-full text-[12px] font-medium text-[#6B6A66] dark:text-[#9E9C97] border border-black/[.08] dark:border-white/[.08] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition px-[14px] py-[10px] rounded-[8px]"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {t("createFollowup")}
          </Link>
        </div>
      </aside>

      {/* Diálogo de confirmação para ações sensíveis (marcar falta / cancelar) */}
      {pendingAction && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("confirm.dismiss")}
            onClick={() => setPendingAction(null)}
            className="absolute inset-0 bg-[#0F1A2E]/40"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            className="relative w-full max-w-[320px] bg-white dark:bg-[#111827] border border-black/[.10] dark:border-white/[.10] rounded-[12px] shadow-xl p-[18px]"
          >
            <p className="text-[14px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2] mb-[6px]">
              {t(`confirm.${pendingAction}.title`)}
            </p>
            <p className="text-[12px] text-[#6B6A66] dark:text-[#9E9C97] leading-relaxed">
              {t(`confirm.${pendingAction}.body`, { patient: patientName })}
            </p>
            {pendingAction === "cancel" && cancelKind && (
              <p className="mt-[8px] text-[11px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] bg-[#F4F3EF] dark:bg-white/[.06] rounded-[8px] px-[10px] py-[8px]">
                {t("confirm.cancel.windowNote", { classification: tStatus(cancelKind) })}
              </p>
            )}
            <div className="mt-[14px] flex gap-[8px] justify-end">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={isPending}
                className="text-[12px] font-medium text-[#6B6A66] dark:text-[#9E9C97] border border-black/[.10] dark:border-white/[.10] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition px-[14px] py-[7px] rounded-[8px] disabled:opacity-50"
              >
                {t("confirm.dismiss")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = pendingAction;
                  setPendingAction(null);
                  applyAction(action);
                }}
                disabled={isPending}
                className={`text-[12px] font-medium text-white transition px-[14px] py-[7px] rounded-[8px] disabled:opacity-50 ${
                  pendingAction === "no_show" ? "bg-amber-600 hover:bg-amber-700" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {t(`confirm.${pendingAction}.confirm`)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
