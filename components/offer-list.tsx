"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { MonetizationOffer } from "@/lib/types";

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
        ${checked ? "bg-[#0F6E56]" : "bg-[#D3D1C7]"}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-150
        ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  );
}

const OFFER_TYPE_KEYS: Record<string, string> = {
  session_package: "typeSessionPackage",
  membership:      "typeMembership",
  single_session:  "typeSingleSession",
  course:          "typeCourse",
};

const OFFER_TYPE_COLORS: Record<string, string> = {
  session_package: "bg-[#E1F5EE] text-[#085041]",
  membership:      "bg-[#EEF2FF] text-[#3730A3]",
  single_session:  "bg-[#F4F3EF] text-[#6B6A66]",
  course:          "bg-[#FFF7ED] text-[#92400E]",
};

interface Props {
  offers: MonetizationOffer[];
  createAction: (fd: FormData) => Promise<void>;
  editAction: (id: string, fd: FormData) => Promise<void>;
  toggleActiveAction: (id: string, isActive: boolean) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
}

export function OfferList({ offers, createAction, editAction, toggleActiveAction, deleteAction }: Props) {
  const t = useTranslations("settings.offers");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formType, setFormType] = useState<string>("session_package");

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createAction(fd);
      (e.target as HTMLFormElement).reset();
      setFormType("session_package");
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

  // Group by type for display
  const grouped = offers.reduce<Record<string, MonetizationOffer[]>>((acc, o) => {
    const key = o.offer_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  return (
    <div>
      <div className="bg-white border border-black/[.07] rounded-[14px] overflow-hidden mb-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[.06]">
          <div>
            <p className="text-[13px] font-medium text-[#0F1A2E]">
              {t("count", { count: offers.length })}
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-[6px] text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-[8px]"
          >
            {showForm ? t("cancel") : t("newOffer")}
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="px-5 py-4 border-b border-black/[.06] bg-[#FAFAF8]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {/* Name */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("name")}</label>
                <input
                  name="name"
                  required
                  placeholder={t("namePlaceholder")}
                  className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("type")}</label>
                <select
                  name="offer_type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                >
                  <option value="session_package">{t("typeSessionPackage")}</option>
                  <option value="membership">{t("typeMembership")}</option>
                  <option value="single_session">{t("typeSingleSession")}</option>
                  <option value="course">{t("typeCourse")}</option>
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("price")}</label>
                <input
                  name="price_brl"
                  type="number"
                  required
                  min={0}
                  step={0.01}
                  defaultValue={0}
                  className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                />
              </div>

              {/* Sessions */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">
                  {formType === "membership" ? t("sessionsPerMonth") : t("numSessions")}
                </label>
                <input
                  name="number_of_sessions"
                  type="number"
                  required
                  min={1}
                  max={500}
                  defaultValue={1}
                  className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                />
              </div>

              {/* Billing interval — only for membership */}
              {formType === "membership" && (
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("billing")}</label>
                  <select
                    name="billing_interval"
                    defaultValue="monthly"
                    className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                  >
                    <option value="monthly">{t("monthly")}</option>
                    <option value="yearly">{t("yearly")}</option>
                  </select>
                </div>
              )}

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("description")}</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder={t("descriptionPlaceholder")}
                  className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] resize-none transition"
                />
              </div>
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

        {/* Empty state */}
        {offers.length === 0 && !showForm ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[13px] text-[#A09E98]">{t("empty")}</p>
            <p className="text-[12px] text-[#C5C3BC] mt-1">{t("emptyHint")}</p>
          </div>
        ) : (
          <div>
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                {/* Group header */}
                <div className="px-5 py-2 bg-[#FAFAF8] border-b border-black/[.04]">
                  <span className={`text-[10px] font-semibold uppercase tracking-[.1em] px-[8px] py-[3px] rounded-full ${OFFER_TYPE_COLORS[type] ?? "bg-[#F4F3EF] text-[#6B6A66]"}`}>
                    {OFFER_TYPE_KEYS[type] ? t(OFFER_TYPE_KEYS[type]) : type}
                  </span>
                </div>

                <div className="divide-y divide-black/[.04]">
                  {items.map((offer) => (
                    <div key={offer.id}>
                      {/* Row */}
                      <div className={`flex items-center gap-3 px-5 py-[13px] transition ${!offer.is_active ? "opacity-50" : ""}`}>
                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{offer.name}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-[2px] flex-wrap">
                            <span className="text-[12px] font-medium text-[#0F6E56]">{formatBRL(offer.price_cents)}</span>
                            <span className="text-[11px] text-[#A09E98]">·</span>
                            <span className="text-[11px] text-[#A09E98]">
                              {t("sessionsLabel", { count: offer.number_of_sessions })}
                              {offer.offer_type === "membership" ? t("perMonthSuffix") : ""}
                            </span>
                            {offer.description && (
                              <>
                                <span className="text-[11px] text-[#A09E98]">·</span>
                                <span className="text-[11px] text-[#A09E98] truncate max-w-[200px]">{offer.description}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="flex items-center gap-1.5 text-[10px] text-[#A09E98]">
                            <Toggle
                              checked={offer.is_active}
                              onChange={() => handleToggleActive(offer.id, offer.is_active)}
                              label={t("toggleActive")}
                            />
                            <span className="hidden sm:inline">{t("toggleActive")}</span>
                          </label>

                          {/* Edit */}
                          <button
                            onClick={() => setEditingId(editingId === offer.id ? null : offer.id)}
                            disabled={pendingId === offer.id + "-edit"}
                            className={`w-7 h-7 flex items-center justify-center rounded-[6px] transition disabled:opacity-40
                              ${editingId === offer.id
                                ? "text-[#0F6E56] bg-[#0F6E56]/[.10]"
                                : "text-[#A09E98] hover:text-[#0F6E56] hover:bg-[#0F6E56]/[.07]"}`}
                            title={editingId === offer.id ? t("cancelEdit") : t("edit")}
                          >
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                              <path d="M9 2l2 2-7 7H2v-2L9 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(offer.id, offer.name)}
                            disabled={pendingId === offer.id + "-delete"}
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
                      {editingId === offer.id && (
                        <form
                          onSubmit={(e) => handleEdit(offer.id, e)}
                          className="px-5 py-4 border-t border-black/[.05] bg-[#F5F4F0]"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("name")}</label>
                              <input
                                name="name"
                                required
                                defaultValue={offer.name}
                                className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("price")}</label>
                              <input
                                name="price_brl"
                                type="number"
                                required
                                min={0}
                                step={0.01}
                                defaultValue={(offer.price_cents / 100).toFixed(2)}
                                className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">
                                {offer.offer_type === "membership" ? t("sessionsPerMonth") : t("numSessions")}
                              </label>
                              <input
                                name="number_of_sessions"
                                type="number"
                                required
                                min={1}
                                max={500}
                                defaultValue={offer.number_of_sessions}
                                className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                              />
                            </div>
                            {offer.offer_type === "membership" && (
                              <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("billing")}</label>
                                <select
                                  name="billing_interval"
                                  defaultValue={(offer as MonetizationOffer & { billing_interval?: string }).billing_interval ?? "monthly"}
                                  className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] transition"
                                >
                                  <option value="monthly">{t("monthly")}</option>
                                  <option value="yearly">{t("yearly")}</option>
                                </select>
                              </div>
                            )}
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold uppercase tracking-[.07em] text-[#A09E98] mb-[4px]">{t("descriptionEdit")}</label>
                              <textarea
                                name="description"
                                rows={2}
                                defaultValue={offer.description ?? ""}
                                className="w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[7px] outline-none focus:border-[#0F6E56] resize-none transition"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={pendingId === offer.id + "-edit"}
                              className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-60 transition px-[14px] py-[7px] rounded-[8px]"
                            >
                              {pendingId === offer.id + "-edit" ? t("saving") : t("saveChanges")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-[12px] font-medium text-[#6B6A66] hover:text-[#0F1A2E] transition px-[14px] py-[7px] rounded-[8px] border border-black/[.08]"
                            >
                              {t("cancel")}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info tip */}
      <div className="bg-[#F0FDF4] border border-[#0F6E56]/20 rounded-[10px] px-[16px] py-[12px] flex items-start gap-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-[1px]">
          <rect width="16" height="16" rx="8" fill="#0F6E56" fillOpacity=".12"/>
          <path d="M8 5v4M8 10.5v.5" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p className="text-[12px] text-[#065F46] leading-relaxed">
          {t.rich("infoTip", { b: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </div>
    </div>
  );
}
