"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { SessionType } from "@/lib/types";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  sessionTypes: SessionType[];
  createAction: (fd: FormData) => Promise<void>;
  toggleOnlineAction: (id: string, isOnline: boolean) => Promise<void>;
  toggleRecordingAction: (id: string, isRecorded: boolean) => Promise<void>;
  toggleActiveAction: (id: string, isActive: boolean) => Promise<void>;
  editAction: (id: string, fd: FormData) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none
        ${checked ? "bg-[#0F6E56]" : "bg-[#D3D1C7] dark:bg-white/[.15]"}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150
        ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

export function SessionTypeList({ sessionTypes, createAction, toggleOnlineAction, toggleRecordingAction, toggleActiveAction, editAction, deleteAction }: Props) {
  const t = useTranslations("settings.sessionTypes");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleToggleOnline(id: string, current: boolean) {
    setPendingId(id + "-online");
    startTransition(async () => {
      await toggleOnlineAction(id, !current);
      setPendingId(null);
    });
  }

  function handleToggleRecording(id: string, current: boolean) {
    setPendingId(id + "-recording");
    startTransition(async () => {
      await toggleRecordingAction(id, !current);
      setPendingId(null);
    });
  }

  function handleToggleActive(id: string, current: boolean) {
    setPendingId(id + "-active");
    startTransition(async () => {
      await toggleActiveAction(id, !current);
      setPendingId(null);
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(t("confirmDelete", { name }))) return;
    setPendingId(id + "-delete");
    startTransition(async () => {
      await deleteAction(id);
      setPendingId(null);
    });
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createAction(fd);
      (e.target as HTMLFormElement).reset();
      setShowForm(false);
    });
  }

  function handleEdit(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPendingId(id + "-edit");
    startTransition(async () => {
      await editAction(id, fd);
      setPendingId(null);
      setEditingId(null);
    });
  }

  return (
    <div>
      {/* List */}
      <div className="bg-white dark:bg-[#161B26] border border-black/[.07] dark:border-white/[.08] rounded-[14px] overflow-hidden mb-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[.06] dark:border-white/[.07]">
          <div>
            <p className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">
              {t("count", { count: sessionTypes.length })}
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-[8px]"
          >
            {showForm ? t("cancel") : t("newType")}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="px-5 py-4 border-b border-black/[.06] dark:border-white/[.07] bg-[#FAFAF8] dark:bg-white/[.02]">
            <div className="grid grid-cols-2 gap-3 mb-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("name")}</label>
                <input
                  name="name"
                  required
                  placeholder={t("namePlaceholder")}
                  className="w-full text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-white dark:bg-[#1C2333] border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("duration")}</label>
                <input
                  name="duration_minutes"
                  type="number"
                  required
                  min={15}
                  step={5}
                  defaultValue={60}
                  className="w-full text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-white dark:bg-[#1C2333] border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("price")}</label>
                <input
                  name="price_brl"
                  type="number"
                  min={0}
                  step={0.01}
                  defaultValue={0}
                  className="w-full text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-white dark:bg-[#1C2333] border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                />
              </div>
            </div>

            {/* Online toggle inside form */}
            <div className="flex items-center gap-3 mb-4">
              <input type="hidden" name="is_online" id="new-is-online-hidden" value="false" />
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_online_check"
                  className="sr-only"
                  onChange={(e) => {
                    const hidden = document.getElementById("new-is-online-hidden") as HTMLInputElement;
                    if (hidden) hidden.value = e.target.checked ? "true" : "false";
                  }}
                />
                <span className="text-[12px] text-[#6B6A66] dark:text-[#9E9C97]">
                  {t("onlineHint")}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-60 transition px-[14px] py-[7px] rounded-[8px]"
            >
              {isPending ? t("saving") : t("create")}
            </button>
          </form>
        )}

        {/* Table */}
        {sessionTypes.length === 0 && !showForm ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[13px] text-[#A09E98]">{t("empty")}</p>
            <p className="text-[12px] text-[#C5C3BC] mt-1">{t("emptyHint")}</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[.04] dark:divide-white/[.04]">
            {/* Column headers */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_90px_80px_90px_80px_64px] gap-4 px-5 py-2 bg-[#FAFAF8] dark:bg-white/[.02]">
              {[t("colName"), t("colDuration"), t("colPrice"), t("colOnline"), t("colRecord"), t("colActive"), ""].map((h, i) => (
                <p key={i} className="text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98]">{h}</p>
              ))}
            </div>

            {sessionTypes.map((st) => (
              <div key={st.id}>
                {/* Row */}
                <div className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_90px_80px_90px_80px_64px] gap-4 items-center px-5 py-[13px] transition ${!st.is_active ? "opacity-50" : ""} ${editingId === st.id ? "bg-[#FAFAF8] dark:bg-white/[.02]" : ""}`}>
                  {/* Name */}
                  <div>
                    <p className="text-[13px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">{st.name}</p>
                    <p className="text-[11px] text-[#A09E98] sm:hidden mt-[1px]">
                      {st.duration_minutes} {t("durationUnit")} · {formatBRL(st.price_cents)}
                    </p>
                  </div>

                  {/* Duration — hidden on mobile */}
                  <p className="hidden sm:block text-[13px] text-[#6B6A66] dark:text-[#9E9C97]">{st.duration_minutes} {t("durationUnit")}</p>

                  {/* Price */}
                  <p className="hidden sm:block text-[13px] text-[#6B6A66] dark:text-[#9E9C97]">{formatBRL(st.price_cents)}</p>

                  {/* Online toggle */}
                  <div className="hidden sm:flex items-center gap-2">
                    <Toggle
                      checked={st.is_online}
                      onChange={() => handleToggleOnline(st.id, st.is_online)}
                      label={t("toggleOnline")}
                    />
                    {st.is_online && (
                      <span className="text-[10px] font-medium text-[#2D8CFF] bg-[#2D8CFF]/[.10] px-[6px] py-[2px] rounded-full">Zoom</span>
                    )}
                  </div>

                  {/* Recording toggle — only visible when online */}
                  <div className="hidden sm:flex items-center gap-2">
                    {st.is_online ? (
                      <>
                        <Toggle
                          checked={st.is_recorded ?? true}
                          onChange={() => handleToggleRecording(st.id, st.is_recorded ?? true)}
                          label={t("toggleRecord")}
                        />
                        {(st.is_recorded ?? true) && (
                          <span className="text-[10px] font-medium text-[#7C3AED] bg-[#7C3AED]/[.10] px-[6px] py-[2px] rounded-full">REC</span>
                        )}
                      </>
                    ) : (
                      <span className="text-[11px] text-[#D3D1C7]">—</span>
                    )}
                  </div>

                  {/* Active toggle */}
                  <div className="hidden sm:block">
                    <Toggle
                      checked={st.is_active}
                      onChange={() => handleToggleActive(st.id, st.is_active)}
                      label={t("toggleActive")}
                    />
                  </div>

                  {/* Edit + Delete */}
                  <div className="flex items-center gap-1 sm:justify-end">
                    {/* Mobile: show toggles inline */}
                    <div className="flex items-center gap-3 sm:hidden mr-2">
                      <label className="flex items-center gap-1 text-[10px] text-[#A09E98]">
                        <Toggle checked={st.is_online} onChange={() => handleToggleOnline(st.id, st.is_online)} label={t("toggleOnline")} />
                        {t("toggleOnline")}
                      </label>
                      {st.is_online && (
                        <label className="flex items-center gap-1 text-[10px] text-[#A09E98]">
                          <Toggle checked={st.is_recorded ?? true} onChange={() => handleToggleRecording(st.id, st.is_recorded ?? true)} label={t("toggleRecord")} />
                          {t("toggleRecord")}
                        </label>
                      )}
                      <label className="flex items-center gap-1 text-[10px] text-[#A09E98]">
                        <Toggle checked={st.is_active} onChange={() => handleToggleActive(st.id, st.is_active)} label={t("toggleActive")} />
                        {t("toggleActive")}
                      </label>
                    </div>
                    {/* Edit button */}
                    <button
                      onClick={() => setEditingId(editingId === st.id ? null : st.id)}
                      disabled={pendingId === st.id + "-edit"}
                      className={`w-7 h-7 flex items-center justify-center rounded-[6px] transition disabled:opacity-40
                        ${editingId === st.id
                          ? "text-[#0F6E56] bg-[#0F6E56]/[.10]"
                          : "text-[#A09E98] hover:text-[#0F6E56] hover:bg-[#0F6E56]/[.07]"}`}
                      title={editingId === st.id ? t("cancelEdit") : t("edit")}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M9 2l2 2-7 7H2v-2L9 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(st.id, st.name)}
                      disabled={pendingId === st.id + "-delete"}
                      className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#A09E98] hover:text-[#DC2626] hover:bg-[#DC2626]/[.07] transition disabled:opacity-40"
                      title={t("remove")}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M5.5 6v3.5M7.5 6v3.5M3 3.5l.5 7a1 1 0 001 1h4a1 1 0 001-1l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === st.id && (
                  <form
                    onSubmit={(e) => handleEdit(st.id, e)}
                    className="px-5 py-4 border-t border-black/[.05] dark:border-white/[.06] bg-[#F5F4F0] dark:bg-white/[.03]"
                  >
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("name")}</label>
                        <input
                          name="name"
                          required
                          defaultValue={st.name}
                          className="w-full text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-white dark:bg-[#1C2333] border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("duration")}</label>
                        <input
                          name="duration_minutes"
                          type="number"
                          required
                          min={15}
                          step={5}
                          defaultValue={st.duration_minutes}
                          className="w-full text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-white dark:bg-[#1C2333] border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("price")}</label>
                        <input
                          name="price_brl"
                          type="number"
                          min={0}
                          step={0.01}
                          defaultValue={(st.price_cents / 100).toFixed(2)}
                          className="w-full text-[13px] text-[#0F1A2E] dark:text-[#E8E6E2] bg-white dark:bg-[#1C2333] border border-black/[.10] dark:border-white/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={pendingId === st.id + "-edit"}
                        className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-60 transition px-[14px] py-[7px] rounded-[8px]"
                      >
                        {pendingId === st.id + "-edit" ? t("saving") : t("saveChanges")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-[12px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition px-[14px] py-[7px] rounded-[8px] border border-black/[.08] dark:border-white/[.08]"
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Explainer */}
      <div className="bg-[#EFF6FF] dark:bg-[#2D8CFF]/[.08] border border-[#2D8CFF]/20 rounded-[10px] px-[16px] py-[12px] flex items-start gap-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-[1px]">
          <rect width="16" height="16" rx="8" fill="#2D8CFF" fillOpacity=".15"/>
          <path d="M8 5v4M8 10.5v.5" stroke="#2D8CFF" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p className="text-[12px] text-[#2563EB] dark:text-[#93C5FD] leading-relaxed">
          {t.rich("explainer", {
            b: (chunks) => <strong>{chunks}</strong>,
            a: (chunks) => <a href="/settings/integrations" className="underline hover:no-underline">{chunks}</a>,
          })}
        </p>
      </div>
    </div>
  );
}
