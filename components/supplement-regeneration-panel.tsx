"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  getRegenerationOverviewAction,
  enqueueEligibleRegenerationAction,
  processRegenerationBatchAction,
  bulkSendApprovedAction,
  retryFailedSendsAction,
  type RegenerationOverview,
} from "@/app/settings/supplements/regeneration/actions";

type Busy = null | "load" | "enqueue" | "process" | "processAll" | "send" | "retry";

export function SupplementRegenerationPanel() {
  const t = useTranslations("settings.regeneration");
  const [overview, setOverview] = useState<RegenerationOverview | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getRegenerationOverviewAction();
    if (res.ok) setOverview(res.data);
    else setMessage(res.error);
  }, []);

  useEffect(() => {
    setBusy("load");
    load().finally(() => setBusy(null));
  }, [load]);

  const enqueue = async () => {
    setBusy("enqueue");
    setMessage(null);
    try {
      const res = await enqueueEligibleRegenerationAction();
      setMessage(res.ok ? t("enqueued", { enqueued: res.enqueued, skipped: res.skipped }) : res.error);
      await load();
    } catch {
      setMessage(t("error"));
    } finally {
      setBusy(null);
    }
  };

  const processOnce = async () => {
    setBusy("process");
    setMessage(null);
    try {
      const res = await processRegenerationBatchAction();
      setMessage(res.ok ? t("processed", { done: res.done, failed: res.failed }) : res.error);
      await load();
    } catch {
      setMessage(t("error"));
    } finally {
      setBusy(null);
    }
  };

  // Processa em ondas: chama o lote repetidamente até a fila esvaziar. Não recarrega
  // o overview a cada iteração (a elegibilidade é cara); atualiza só ao final.
  const processAll = async () => {
    setBusy("processAll");
    setMessage(null);
    let totalDone = 0;
    let totalFailed = 0;
    try {
      for (let i = 0; i < 500; i++) {
        const res = await processRegenerationBatchAction();
        if (!res.ok) {
          setMessage(res.error);
          break;
        }
        totalDone += res.done;
        totalFailed += res.failed;
        setMessage(t("processed", { done: totalDone, failed: totalFailed }));
        if (res.claimed === 0) break; // nada mais pendente
      }
      await load();
    } catch {
      setMessage(t("error"));
      await load().catch(() => {});
    } finally {
      setBusy(null);
    }
  };

  // Envia em ondas os aprovados prontos até esgotar.
  const sendApproved = async () => {
    setBusy("send");
    setMessage(null);
    let totalSent = 0;
    let totalFailed = 0;
    try {
      for (let i = 0; i < 500; i++) {
        const res = await bulkSendApprovedAction();
        if (!res.ok) {
          setMessage(res.error);
          break;
        }
        totalSent += res.sent;
        totalFailed += res.failed;
        setMessage(t("sent", { sent: totalSent, failed: totalFailed }));
        if (res.sent + res.failed === 0) break; // nada mais pronto
      }
      await load();
    } catch {
      setMessage(t("error"));
      await load().catch(() => {});
    } finally {
      setBusy(null);
    }
  };

  const retryFailed = async () => {
    setBusy("retry");
    setMessage(null);
    try {
      const res = await retryFailedSendsAction();
      setMessage(res.ok ? t("retried", { reset: res.reset }) : res.error);
      await load();
    } catch {
      setMessage(t("error"));
    } finally {
      setBusy(null);
    }
  };

  const s = overview?.summary;
  const eligible = overview?.eligibleCount ?? 0;
  const sendable = overview?.sendableCount ?? 0;
  const sendFailed = overview?.failedSendCount ?? 0;
  const pending = s?.pending ?? 0;
  const anyBusy = busy !== null;

  const stat = (label: string, value: number) => (
    <div className="rounded-lg bg-black/[.03] px-3 py-2">
      <div className="text-[11px] uppercase tracking-[.08em] text-black/40">{label}</div>
      <div className="text-lg font-semibold text-[#0F1A2E]">{value}</div>
    </div>
  );

  const btn =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="space-y-6">
      <p className="text-[12px] text-black/50">
        {t("configVersion")}: <span className="font-mono text-[#0F1A2E]">{overview?.configVersion ?? "…"}</span>
      </p>

      <div>
        <div className="text-sm font-medium text-[#0F1A2E]">{t("eligibleLabel")}</div>
        <div className="text-3xl font-semibold text-[#0F6E56] mt-1">{eligible}</div>
        <div className="text-[12px] text-black/45 mt-1">{t("eligibleHint")}</div>
        <button
          type="button"
          onClick={enqueue}
          disabled={anyBusy || eligible === 0}
          className={`${btn} mt-3 bg-[#0F1A2E] text-white hover:bg-[#0F1A2E]/90`}
        >
          {busy === "enqueue" ? t("enqueuing") : t("enqueue")}
        </button>
      </div>

      <div>
        <div className="text-sm font-medium text-[#0F1A2E] mb-2">{t("queueTitle")}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stat(t("pending"), pending)}
          {stat(t("processing"), s?.processing ?? 0)}
          {stat(t("done"), s?.done ?? 0)}
          {stat(t("failed"), s?.failed ?? 0)}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={processOnce}
            disabled={anyBusy || pending === 0}
            className={`${btn} bg-[#0F6E56] text-white hover:bg-[#0F6E56]/90`}
          >
            {busy === "process" ? t("processingBatch") : t("process")}
          </button>
          <button
            type="button"
            onClick={processAll}
            disabled={anyBusy || pending === 0}
            className={`${btn} border border-[#0F6E56] text-[#0F6E56] hover:bg-[#0F6E56]/5`}
          >
            {busy === "processAll" ? t("processingBatch") : t("processAll")}
          </button>
          <button
            type="button"
            onClick={() => {
              setBusy("load");
              load().finally(() => setBusy(null));
            }}
            disabled={anyBusy}
            className={`${btn} text-black/50 hover:text-[#0F1A2E]`}
          >
            {t("refresh")}
          </button>
        </div>
      </div>

      <div className="border-t border-black/5 pt-5">
        <div className="text-sm font-medium text-[#0F1A2E]">{t("sendableLabel")}</div>
        <div className="text-3xl font-semibold text-[#0F6E56] mt-1">{sendable}</div>
        <div className="text-[12px] text-black/45 mt-1">{t("sendableHint")}</div>
        <button
          type="button"
          onClick={sendApproved}
          disabled={anyBusy || sendable === 0}
          className={`${btn} mt-3 bg-[#0F6E56] text-white hover:bg-[#0F6E56]/90`}
        >
          {busy === "send" ? t("sending") : t("send")}
        </button>
      </div>

      {sendFailed > 0 && (
        <div className="rounded-lg bg-[#B4441E]/[.06] px-3 py-3">
          <div className="text-sm font-medium text-[#B4441E]">
            {t("sendFailedLabel")}: {sendFailed}
          </div>
          <div className="text-[12px] text-black/50 mt-1">{t("sendFailedHint")}</div>
          <button
            type="button"
            onClick={retryFailed}
            disabled={anyBusy}
            className={`${btn} mt-2 border border-[#B4441E]/40 text-[#B4441E] hover:bg-[#B4441E]/5`}
          >
            {busy === "retry" ? t("retrying") : t("retry")}
          </button>
        </div>
      )}

      {eligible === 0 && pending === 0 && sendable === 0 && sendFailed === 0 && busy === null && (
        <p className="text-[13px] text-black/45">{t("nothingEligible")}</p>
      )}
      {message && <p className="text-[13px] text-[#0F1A2E] bg-[#0F6E56]/[.06] rounded-lg px-3 py-2">{message}</p>}
      <p className="text-[12px] text-black/45 border-t border-black/5 pt-4">{t("reviewHint")}</p>
    </div>
  );
}
