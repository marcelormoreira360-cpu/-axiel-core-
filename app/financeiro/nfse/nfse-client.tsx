"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { FileText, RefreshCw, X, ExternalLink, Plus } from "lucide-react";
import { formatCpf, validateCpf } from "@/lib/utils";
import type { NfseInvoice } from "@/services/nfse-service";
import { emitNfseAction, syncNfseAction, cancelNfseAction } from "./actions";
import { useFormatMoney } from "@/components/currency-provider";

interface Props {
  invoices: NfseInvoice[];
  defaultServiceDescription: string;
  patients: { id: string; full_name: string; email: string | null; cpf?: string | null }[];
}

const STATUS_CLS: Record<string, string> = {
  processing: "bg-amber-50 text-amber-600",
  issued:     "bg-[#E1F5EE] text-[#0F6E56]",
  cancelled:  "bg-[#F4F3EF] dark:bg-white/[.06] text-[#A09E98] line-through",
  error:      "bg-red-50 text-red-600",
};

export function NfseClient({ invoices, defaultServiceDescription, patients }: Props) {
  const money = useFormatMoney();
  const t = useTranslations("finance.nfse");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [cpfValue, setCpfValue] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); }

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  function handleCpfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCpf(e.target.value);
    setCpfValue(formatted);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 11) {
      setCpfError(validateCpf(digits) ? null : t("cpfInvalid"));
    } else {
      setCpfError(null);
    }
  }

  function handleEmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const digits = cpfValue.replace(/\D/g, "");
    if (digits.length > 0 && !validateCpf(digits)) {
      setError(t("cpfInvalidFull"));
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await emitNfseAction(fd);
      if (r.error) { setError(r.error); return; }
      setShowModal(false);
      setCpfValue("");
      flash(t("flashSent"));
      router.refresh();
    });
  }

  function handleSync(localId: string) {
    startTransition(async () => {
      const r = await syncNfseAction(localId);
      if (r.error) { setError(r.error); return; }
      router.refresh();
    });
  }

  function handleCancel(localId: string) {
    if (!confirm(t("confirmCancel"))) return;
    startTransition(async () => {
      const r = await cancelNfseAction(localId);
      if (r.error) { setError(r.error); return; }
      flash(t("flashCancelled"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {(error || success) && (
        <div className={`rounded-lg px-4 py-2.5 text-[12px] ${error ? "bg-red-50 text-red-600" : "bg-[#E1F5EE] text-[#0F6E56]"}`}>
          {error ?? success}
        </div>
      )}

      {/* Emit button */}
      <div className="flex justify-end">
        <button
          onClick={() => { setShowModal(true); setError(null); setCpfValue(""); setCpfError(null); }}
          className="flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] dark:bg-white/[.10] px-4 py-2 text-[12px] font-medium text-white hover:bg-black dark:hover:bg-white/[.16] transition"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("emit")}
        </button>
      </div>

      {/* Invoices table */}
      <div className="rounded-2xl border border-black/[.07] dark:border-white/[.07] bg-white dark:bg-[#111827] overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[.05] dark:border-white/[.05]">
          <p className="text-[13px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{t("issuedTitle")}</p>
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <FileText className="h-8 w-8 text-[#D3D1C7]" />
            <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[.05] dark:border-white/[.05] bg-[#FAFAF8] dark:bg-white/[.03]">
                  {[
                    { label: t("colDate"), right: false },
                    { label: t("colBorrower"), right: false },
                    { label: t("colAmount"), right: true },
                    { label: t("colNumber"), right: true },
                    { label: t("colStatus"), right: false },
                    { label: "", right: false },
                  ].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 ${h.right ? "text-right" : "text-left"}`}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.04] dark:divide-white/[.05]">
                {invoices.map((inv) => {
                  const stCls = STATUS_CLS[inv.status] ?? STATUS_CLS.processing;
                  return (
                    <tr key={inv.id} className="hover:bg-[#FAFAF8] dark:hover:bg-white/[.03] transition">
                      <td className="px-4 py-3 text-[12px] text-[#6B6A66] dark:text-[#9E9C97] whitespace-nowrap">
                        {new Date(inv.created_at).toLocaleDateString(locale)}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2]">
                        {inv.borrower_name ?? "—"}
                        {inv.borrower_cpf && <span className="text-[10px] text-[#A09E98] ml-1">({inv.borrower_cpf})</span>}
                      </td>
                      <td className="px-4 py-3 text-[12px] font-semibold text-right text-[#0F1A2E] dark:text-[#E8E6E2]">
                        {money(inv.amount_cents)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-right text-[#6B6A66] dark:text-[#9E9C97]">
                        {inv.nfse_number ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${stCls}`}>
                          {t(`status.${inv.status}`)}
                        </span>
                        {inv.status === "error" && inv.error_message && (
                          <p className="text-[10px] text-red-400 mt-0.5 max-w-[160px]">{inv.error_message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {inv.pdf_url && (
                            <a
                              href={inv.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] font-medium text-[#0F6E56] hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              PDF
                            </a>
                          )}
                          {(inv.status === "processing" || inv.status === "error") && (
                            <button
                              onClick={() => handleSync(inv.id)}
                              disabled={isPending}
                              className="flex items-center gap-1 text-[11px] text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition disabled:opacity-50"
                              title={t("syncTitle")}
                            >
                              <RefreshCw className={`h-3 w-3 ${isPending ? "animate-spin" : ""}`} />
                            </button>
                          )}
                          {inv.status === "issued" && (
                            <button
                              onClick={() => handleCancel(inv.id)}
                              disabled={isPending}
                              className="text-[11px] text-red-400 hover:text-red-600 transition disabled:opacity-50"
                            >
                              {t("cancel")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Emit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#111827] rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[.07] dark:border-white/[.07]">
              <p className="text-[14px] font-semibold text-[#0F1A2E] dark:text-[#E8E6E2]">{t("modalTitle")}</p>
              <button onClick={() => { setShowModal(false); setCpfValue(""); setCpfError(null); }} className="text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEmit} className="p-5 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</div>
              )}

              {/* Patient selector */}
              <div>
                <label className="block text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97] mb-1.5">{t("patientOpt")}</label>
                <select
                  className="w-full rounded-lg border border-black/15 dark:border-white/15 dark:bg-transparent dark:text-[#E8E6E2] px-3 py-2 text-sm focus:outline-none"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  <option value="">{t("selectPatient")}</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
                {selectedPatientId && <input type="hidden" name="patient_id" value={selectedPatientId} />}
              </div>

              {/* Borrower name */}
              <div>
                <label className="block text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97] mb-1.5">{t("borrowerName")} <span className="text-red-400">*</span></label>
                <input
                  name="borrower_name"
                  required
                  defaultValue={selectedPatient?.full_name ?? ""}
                  key={selectedPatientId + "_name"}
                  placeholder={t("borrowerNamePlaceholder")}
                  className="w-full rounded-lg border border-black/15 dark:border-white/15 dark:bg-transparent dark:text-[#E8E6E2] px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* CPF */}
                <div>
                  <label className="block text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97] mb-1.5">{t("cpfOpt")}</label>
                  <input
                    name="borrower_cpf"
                    value={cpfValue}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${cpfError ? "border-red-400" : "border-black/15 dark:border-white/15 dark:bg-transparent dark:text-[#E8E6E2]"}`}
                  />
                  {cpfError && <p className="text-[10px] text-red-500 mt-1">{cpfError}</p>}
                </div>
                {/* Email */}
                <div>
                  <label className="block text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97] mb-1.5">{t("emailOpt")}</label>
                  <input
                    name="borrower_email"
                    type="email"
                    defaultValue={selectedPatient?.email ?? ""}
                    key={selectedPatientId + "_email"}
                    placeholder={t("emailPlaceholder")}
                    className="w-full rounded-lg border border-black/15 dark:border-white/15 dark:bg-transparent dark:text-[#E8E6E2] px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97] mb-1.5">{t("amount")} <span className="text-red-400">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#6B6A66] dark:text-[#9E9C97]">R$</span>
                  <input
                    name="amount_reais"
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full rounded-lg border border-black/15 dark:border-white/15 dark:bg-transparent dark:text-[#E8E6E2] pl-9 pr-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-[#A09E98] mt-1">{t("amountHint")}</p>
              </div>

              {/* Service description */}
              <div>
                <label className="block text-[11px] font-medium text-[#6B6A66] dark:text-[#9E9C97] mb-1.5">{t("serviceDesc")}</label>
                <input
                  name="service_description"
                  defaultValue={defaultServiceDescription}
                  className="w-full rounded-lg border border-black/15 dark:border-white/15 dark:bg-transparent dark:text-[#E8E6E2] px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setCpfValue(""); setCpfError(null); }}
                  className="flex-1 rounded-lg border border-black/15 dark:border-white/15 dark:bg-transparent dark:text-[#E8E6E2] py-2 text-[12px] font-medium text-[#6B6A66] dark:text-[#9E9C97] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-[#0B1F3A] dark:bg-white/[.10] py-2 text-[12px] font-medium text-white hover:bg-black dark:hover:bg-white/[.16] transition disabled:opacity-50"
                >
                  {isPending ? t("emitting") : t("emit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
