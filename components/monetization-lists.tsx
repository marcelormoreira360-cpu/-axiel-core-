"use client";

import { useState, useTransition } from "react";
import { BadgeDollarSign, PackagePlus, Pencil, Trash2, X, Check } from "lucide-react";
import type { MonetizationOffer, PatientOffer } from "@/lib/types";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { LimitedList } from "@/components/limited-list";
import { formatPrice, getPatientOfferProgress, OFFER_TYPE_LABELS } from "@/modules/monetization/pricing";

export function OfferList({
  offers,
  toggleAction,
  editAction,
  deleteAction,
}: {
  offers: MonetizationOffer[];
  toggleAction: (formData: FormData) => Promise<void>;
  editAction?: (formData: FormData) => Promise<void>;
  deleteAction?: (formData: FormData) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(offer: MonetizationOffer) {
    if (!deleteAction) return;
    if (!confirm(`Remover "${offer.name}"? Esta ação não pode ser desfeita.`)) return;
    const fd = new FormData();
    fd.set("id", offer.id);
    startTransition(() => deleteAction(fd));
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>, offerId: string) {
    e.preventDefault();
    if (!editAction) return;
    const fd = new FormData(e.currentTarget);
    fd.set("id", offerId);
    startTransition(async () => {
      await editAction(fd);
      setEditingId(null);
    });
  }

  if (offers.length === 0) {
    return (
      <EmptyState
        icon={<PackagePlus className="h-7 w-7" />}
        title="No packages or memberships yet"
        text="Create your first offer so the clinic can sell sessions or memberships clearly."
        href="/monetization"
        action="Create first offer"
      />
    );
  }

  return (
    <LimitedList
      items={offers}
      className="grid gap-3 md:grid-cols-2"
      detailsLabel={`View ${Math.max(offers.length - 5, 0)} more offers`}
      renderItem={(offer) => (
        <Card key={offer.id} className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/35">
                {OFFER_TYPE_LABELS[offer.offer_type]}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{offer.name}</h3>
              <p className="mt-2 text-sm leading-5 text-black/50">
                {offer.description || "Flexible clinic-defined offer."}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${offer.is_active ? "bg-emerald-50 text-emerald-700" : "bg-black/5 text-black/45"}`}>
                {offer.is_active ? "Active" : "Paused"}
              </span>
              {editAction && (
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === offer.id ? null : offer.id)}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition
                    ${editingId === offer.id
                      ? "bg-axiel-ink/10 text-axiel-ink"
                      : "text-black/30 hover:bg-black/5 hover:text-black/60"}`}
                  title={editingId === offer.id ? "Cancelar edição" : "Editar"}
                >
                  {editingId === offer.id ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                </button>
              )}
              {deleteAction && (
                <button
                  type="button"
                  onClick={() => handleDelete(offer)}
                  disabled={isPending}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-black/30 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Price / sessions */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-axiel-soft p-4">
              <p className="text-xs text-black/40">Price</p>
              <p className="mt-1 text-xl font-semibold">{formatPrice(offer.price_cents, offer.currency)}</p>
            </div>
            <div className="rounded-2xl bg-axiel-soft p-4">
              <p className="text-xs text-black/40">Sessions</p>
              <p className="mt-1 text-xl font-semibold">
                {offer.number_of_sessions}
                {offer.offer_type === "membership" ? "/mês" : ""}
              </p>
            </div>
          </div>

          {/* Inline edit form */}
          {editingId === offer.id && editAction && (
            <form onSubmit={(e) => handleEdit(e, offer.id)} className="mt-4 space-y-3 rounded-xl border border-black/[.07] bg-black/[.02] p-4">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[.07em] text-black/40">Nome</label>
                <input
                  name="name"
                  required
                  defaultValue={offer.name}
                  className="w-full rounded-lg border border-black/[.10] bg-white px-3 py-2 text-sm text-[#0F1A2E] outline-none focus:border-axiel-ink transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[.07em] text-black/40">Preço (R$)</label>
                  <input
                    name="price_brl"
                    type="number"
                    required
                    min={0}
                    step={0.01}
                    defaultValue={(offer.price_cents / 100).toFixed(2)}
                    className="w-full rounded-lg border border-black/[.10] bg-white px-3 py-2 text-sm text-[#0F1A2E] outline-none focus:border-axiel-ink transition"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[.07em] text-black/40">
                    {offer.offer_type === "membership" ? "Sessões/mês" : "Nº sessões"}
                  </label>
                  <input
                    name="number_of_sessions"
                    type="number"
                    required
                    min={1}
                    max={500}
                    defaultValue={offer.number_of_sessions}
                    className="w-full rounded-lg border border-black/[.10] bg-white px-3 py-2 text-sm text-[#0F1A2E] outline-none focus:border-axiel-ink transition"
                  />
                </div>
              </div>
              {offer.offer_type === "membership" && (
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[.07em] text-black/40">Cobrança</label>
                  <select
                    name="billing_interval"
                    defaultValue={(offer as MonetizationOffer & { billing_interval?: string }).billing_interval ?? "monthly"}
                    className="w-full rounded-lg border border-black/[.10] bg-white px-3 py-2 text-sm text-[#0F1A2E] outline-none focus:border-axiel-ink transition"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[.07em] text-black/40">Descrição</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={offer.description ?? ""}
                  className="w-full resize-none rounded-lg border border-black/[.10] bg-white px-3 py-2 text-sm text-[#0F1A2E] outline-none focus:border-axiel-ink transition"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-axiel-ink px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {isPending ? "Salvando…" : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="rounded-lg border border-black/[.10] px-4 py-2 text-xs font-semibold text-black/50 transition hover:text-black/80"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Toggle active */}
          <form action={toggleAction} className="mt-4">
            <input type="hidden" name="id" value={offer.id} />
            <input type="hidden" name="is_active" value={String(!offer.is_active)} />
            <Button variant="secondary" className="w-full">
              {offer.is_active ? "Pause" : "Reactivate"}
            </Button>
          </form>
        </Card>
      )}
    />
  );
}

export function PatientOfferList({ patientOffers }: { patientOffers: PatientOffer[] }) {
  if (patientOffers.length === 0) {
    return (
      <EmptyState
        icon={<BadgeDollarSign className="h-7 w-7" />}
        title="No patient plans assigned"
        text="Assign a package or membership after creating an offer and adding a patient."
        href="/patients/new"
        action="Add patient"
      />
    );
  }

  return (
    <LimitedList
      items={patientOffers}
      className="space-y-3"
      detailsLabel={`View ${Math.max(patientOffers.length - 5, 0)} more assigned plans`}
      renderItem={(item) => {
        const progress = getPatientOfferProgress(item);
        return (
          <Card key={item.id} className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/35">{item.patients?.full_name ?? "Patient"}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{item.monetization_offers?.name ?? "Assigned offer"}</h3>
                <p className="mt-1 text-sm text-black/45">{progress.remaining} sessions remaining • {item.status}</p>
              </div>
              <div className="min-w-44 rounded-2xl bg-axiel-soft p-4">
                <p className="text-xs text-black/40">Used</p>
                <p className="mt-1 text-2xl font-semibold">{item.sessions_used}/{item.sessions_total}</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5">
              <div className="h-full rounded-full bg-axiel-ink" style={{ width: `${progress.percentage}%` }} />
            </div>
          </Card>
        );
      }}
    />
  );
}
