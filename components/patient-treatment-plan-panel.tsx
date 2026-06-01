"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, CheckCircle2, Circle, Trash2, X, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import type { TreatmentPlan, TreatmentPlanStep } from "@/services/treatment-plan-service";
import {
  createTreatmentPlanAction,
  addPlanStepAction,
  toggleStepAction,
  deleteStepAction,
  updatePlanStatusAction,
} from "@/app/patients/[id]/treatment-plan/actions";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-[#E1F5EE] text-[#085041]",
  paused:    "bg-[#FFF3E0] text-amber-700",
  completed: "bg-[#E8F0FE] text-[#3B6BE4]",
  cancelled: "bg-[#F4F3EF] text-[#A09E98]",
};

function formatDate(iso: string, locale: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString(locale, {
    day: "numeric", month: "short",
  });
}

// ── Step row ──────────────────────────────────────────────────────────────────

function StepRow({
  step,
  patientId,
  planActive,
}: {
  step: TreatmentPlanStep;
  patientId: string;
  planActive: boolean;
}) {
  const t = useTranslations("patientPanels.treatmentPlan");
  const locale = useLocale();
  const [optimistic, setOptimistic] = useState(step.is_completed);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle() {
    const next = !optimistic;
    setOptimistic(next);
    await toggleStepAction(step.id, patientId, next);
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteStepAction(step.id, patientId);
  }

  if (deleting) return null;

  return (
    <div className={[
      "flex items-start gap-[8px] group rounded-[8px] px-[8px] py-[7px] transition",
      optimistic ? "opacity-60" : "hover:bg-[#FAFAF8]",
    ].join(" ")}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={!planActive}
        className={`shrink-0 mt-[1px] transition ${planActive ? "hover:scale-110" : "cursor-default"}`}
      >
        {optimistic
          ? <CheckCircle2 className="h-4 w-4 text-[#0F6E56]" />
          : <Circle className="h-4 w-4 text-[#D3D1C7]" />
        }
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-[12px] leading-snug ${optimistic ? "line-through text-[#A09E98]" : "text-[#0F1A2E]"}`}>
          {step.title}
        </p>
        {step.description && !optimistic && (
          <p className="text-[11px] text-[#A09E98] mt-[1px]">{step.description}</p>
        )}
        {step.due_date && !optimistic && (
          <p className="text-[10px] text-[#D3D1C7] mt-[1px]">{t("stepUntil", { date: formatDate(step.due_date, locale) })}</p>
        )}
      </div>

      {planActive && (
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-[#D3D1C7] hover:text-red-400 transition mt-[2px]"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── Add step form ─────────────────────────────────────────────────────────────

function AddStepForm({
  planId,
  patientId,
  nextIndex,
  onClose,
}: {
  planId: string;
  patientId: string;
  nextIndex: number;
  onClose: () => void;
}) {
  const t = useTranslations("patientPanels.treatmentPlan");
  async function submit(formData: FormData) {
    await addPlanStepAction(formData);
    onClose();
  }

  return (
    <form action={submit} className="mt-[6px] flex flex-col gap-[6px] bg-[#FAFAF8] rounded-[8px] p-[10px]">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="order_index" value={nextIndex} />

      <input
        type="text"
        name="title"
        required
        autoFocus
        placeholder={t("stepForm.placeholder")}
        className="w-full px-[9px] py-[6px] rounded-[7px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
      />
      <div className="flex gap-[6px]">
        <input
          type="date"
          name="due_date"
          className="flex-1 px-[9px] py-[6px] rounded-[7px] border border-black/[.10] text-[12px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
        />
        <button
          type="submit"
          className="text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[7px] px-[12px] py-[6px] transition shrink-0"
        >
          {t("stepForm.add")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-[#A09E98] hover:text-[#0F1A2E] transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}

// ── Create plan form ──────────────────────────────────────────────────────────

function CreatePlanForm({
  patientId,
  onClose,
}: {
  patientId: string;
  onClose: () => void;
}) {
  const t = useTranslations("patientPanels.treatmentPlan.createForm");
  async function submit(formData: FormData) {
    await createTreatmentPlanAction(formData);
    onClose();
  }

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      <div className="flex items-center justify-between px-[14px] py-[11px] bg-[#FAFAF8] border-b border-black/[.06]">
        <p className="text-[12px] font-medium text-[#0F1A2E]">{t("title")}</p>
        <button type="button" onClick={onClose} className="text-[#A09E98] hover:text-[#0F1A2E] transition">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form action={submit} className="px-[14px] py-[14px] space-y-[10px]">
        <input type="hidden" name="patient_id" value={patientId} />

        <div>
          <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("planTitle")}</label>
          <input
            type="text"
            name="title"
            required
            autoFocus
            placeholder={t("planTitlePlaceholder")}
            className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("goal")}</label>
          <textarea
            name="goal"
            rows={2}
            placeholder={t("goalPlaceholder")}
            className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] resize-none transition"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-[#6B6A66] mb-[4px] block">{t("targetEnd")}</label>
          <input
            type="date"
            name="target_end_at"
            className="w-full px-[10px] py-[7px] rounded-[8px] border border-black/[.10] text-[12px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
          />
        </div>

        <div className="flex justify-end pt-[2px]">
          <button
            type="submit"
            className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[16px] py-[8px] transition"
          >
            {t("create")}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, patientId }: { plan: TreatmentPlan; patientId: string }) {
  const t = useTranslations("patientPanels.treatmentPlan");
  const locale = useLocale();
  const [addingStep, setAddingStep] = useState(false);
  const [expanded, setExpanded] = useState(plan.status === "active");
  const [changingStatus, setChangingStatus] = useState(false);

  const done  = plan.steps.filter((s) => s.is_completed).length;
  const total = plan.steps.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const badgeColor = STATUS_COLORS[plan.status] ?? STATUS_COLORS.active;
  const isActive = plan.status === "active";

  async function handleStatus(status: "active" | "paused" | "completed" | "cancelled") {
    setChangingStatus(true);
    await updatePlanStatusAction(plan.id, patientId, status);
    setChangingStatus(false);
  }

  return (
    <div className={[
      "bg-white border rounded-[12px] overflow-hidden transition",
      plan.status === "active" ? "border-[#0F6E56]/20" : "border-black/[.07]",
    ].join(" ")}>
      {/* Card header */}
      <div className="px-[14px] py-[12px]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[7px] mb-[3px]">
              <span className={`text-[9px] font-semibold px-[7px] py-[2px] rounded-full ${badgeColor}`}>
                {t(`status.${plan.status}`)}
              </span>
              {plan.target_end_at && isActive && (
                <span className="text-[10px] text-[#A09E98]">
                  {t("until", { date: formatDate(plan.target_end_at, locale) })}
                </span>
              )}
            </div>
            <p className="text-[13px] font-semibold text-[#0F1A2E] leading-snug">{plan.title}</p>
            {plan.goal && (
              <p className="text-[11px] text-[#6B6A66] mt-[3px] line-clamp-2">{plan.goal}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-[#A09E98] hover:text-[#0F1A2E] transition mt-[2px]"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="mt-[10px]">
            <div className="flex items-center justify-between mb-[4px]">
              <span className="text-[10px] text-[#A09E98]">{t("stepsProgress", { done, total })}</span>
              <span className="text-[10px] font-medium text-[#0F6E56]">{pct}%</span>
            </div>
            <div className="h-[5px] bg-[#F4F3EF] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0F6E56] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-black/[.06] px-[14px] py-[10px]">
          {/* Steps list */}
          {plan.steps.length > 0 ? (
            <div className="space-y-[1px] mb-[4px]">
              {plan.steps.map((step) => (
                <StepRow key={step.id} step={step} patientId={patientId} planActive={isActive} />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#D3D1C7] px-[8px] py-[4px]">
              {t("noSteps")}
            </p>
          )}

          {/* Add step */}
          {isActive && (
            addingStep ? (
              <AddStepForm
                planId={plan.id}
                patientId={patientId}
                nextIndex={plan.steps.length}
                onClose={() => setAddingStep(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingStep(true)}
                className="flex items-center gap-[5px] text-[11px] font-medium text-[#A09E98] hover:text-[#0F6E56] transition mt-[6px] px-[8px]"
              >
                <Plus className="h-3 w-3" /> {t("addStep")}
              </button>
            )
          )}

          {/* Status actions */}
          {isActive && (
            <div className="flex gap-[6px] mt-[12px] pt-[10px] border-t border-black/[.05]">
              <button
                type="button"
                disabled={changingStatus}
                onClick={() => handleStatus("completed")}
                className="text-[10px] font-medium text-[#3B6BE4] border border-[#3B6BE4]/30 hover:bg-[#E8F0FE] rounded-[6px] px-[10px] py-[5px] transition"
              >
                {t("markCompleted")}
              </button>
              <button
                type="button"
                disabled={changingStatus}
                onClick={() => handleStatus("paused")}
                className="text-[10px] font-medium text-amber-700 border border-amber-200 hover:bg-[#FFF3E0] rounded-[6px] px-[10px] py-[5px] transition"
              >
                {t("pause")}
              </button>
            </div>
          )}
          {plan.status === "paused" && (
            <div className="flex gap-[6px] mt-[12px] pt-[10px] border-t border-black/[.05]">
              <button
                type="button"
                disabled={changingStatus}
                onClick={() => handleStatus("active")}
                className="text-[10px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[6px] px-[10px] py-[5px] transition"
              >
                {t("reactivate")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function PatientTreatmentPlanPanel({
  plans,
  patientId,
}: {
  plans: TreatmentPlan[];
  patientId: string;
}) {
  const t = useTranslations("patientPanels.treatmentPlan");
  const [creating, setCreating] = useState(false);

  const activePlan   = plans.find((p) => p.status === "active");
  const otherPlans   = plans.filter((p) => p.status !== "active");

  return (
    <div className="space-y-[8px]">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[6px]">
          <ClipboardList className="h-3.5 w-3.5 text-[#A09E98]" />
          <p className="text-[11px] font-medium text-[#6B6A66]">
            {t("title")}
            {activePlan && <span className="text-[#0F6E56] ml-[4px]">{t("activeSuffix")}</span>}
          </p>
        </div>
        {!creating && !activePlan && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition"
          >
            <Plus className="h-3 w-3" /> {t("createPlan")}
          </button>
        )}
        {!creating && activePlan && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-[4px] text-[11px] font-medium text-[#A09E98] hover:text-[#0F1A2E] transition"
          >
            <Plus className="h-3 w-3" /> {t("newPlan")}
          </button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <CreatePlanForm patientId={patientId} onClose={() => setCreating(false)} />
      )}

      {/* Empty state */}
      {plans.length === 0 && !creating && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[14px] py-[12px]">
          <p className="text-[12px] text-[#D3D1C7]">{t("empty")}</p>
        </div>
      )}

      {/* Active plan first */}
      {activePlan && <PlanCard plan={activePlan} patientId={patientId} />}

      {/* Past plans collapsed */}
      {otherPlans.length > 0 && (
        <div className="space-y-[4px]">
          {otherPlans.length > 0 && (
            <p className="text-[10px] font-medium text-[#D3D1C7] uppercase tracking-[.06em] px-[2px]">
              {t("previous")}
            </p>
          )}
          {otherPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} patientId={patientId} />
          ))}
        </div>
      )}
    </div>
  );
}
