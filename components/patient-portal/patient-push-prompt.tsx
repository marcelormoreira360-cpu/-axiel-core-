"use client";

/**
 * PatientPushPrompt
 *
 * Shown once in the patient portal. Asks the patient to enable push
 * notifications so they receive appointment confirmations, follow-up
 * reminders, and insight updates on their device.
 *
 * Uses the portal token (not Supabase Auth) to subscribe/unsubscribe.
 */

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, X } from "lucide-react";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const DISMISSED_KEY = "patient-push-dismissed";

function urlBase64ToUint8Array(b64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

type State = "idle" | "granted" | "denied" | "unsupported";

export function PatientPushPrompt({ token }: { token: string }) {
  const t = useTranslations("portal.push");
  const [state, setState] = useState<State>("idle");
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Check support
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !VAPID_PUBLIC
    ) {
      setState("unsupported");
      return;
    }

    const perm = Notification.permission as State;
    setState(perm === "granted" ? "granted" : perm === "denied" ? "denied" : "idle");

    if (localStorage.getItem(DISMISSED_KEY)) setDismissed(true);

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setSubscribed(true);
      }),
    );
  }, []);

  async function handleEnable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });

      const json = sub.toJSON();
      await fetch("/api/p/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          token,
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent.slice(0, 200),
        }),
      });

      setState("granted");
      setSubscribed(true);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/p/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unsubscribe", token, endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setState("idle");
    } catch {
      /* silent */
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  // Already subscribed — show subtle status pill
  if (subscribed && state === "granted") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[#E1F5EE] rounded-[8px] text-[11px] text-[#085041]">
        <Bell className="w-3.5 h-3.5 shrink-0" />
        <span>{t("enabled")}</span>
        <button
          onClick={handleDisable}
          className="ml-auto text-[#A09E98] hover:text-red-500 transition"
          title={t("disableTitle")}
        >
          <BellOff className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Not yet asked — show the prompt banner
  if (state === "idle" && !dismissed) {
    return (
      <div className="relative flex items-start gap-3 px-4 py-3 bg-[#FFF8E7] border border-[#F5C47F] rounded-[10px] text-[12px]">
        <Bell className="w-4 h-4 text-[#C97B1A] mt-[1px] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[#633806]">{t("promptTitle")}</p>
          <p className="text-[#7C5B1A] mt-[1px] text-[11px]">
            {t("promptDesc")}
          </p>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="mt-2 px-3 py-1.5 bg-[#C97B1A] text-white rounded-[6px] text-[11px] font-medium hover:bg-[#a96315] transition disabled:opacity-50"
          >
            {loading ? t("enabling") : t("enable")}
          </button>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-[#A09E98] hover:text-[#6B6A66] transition"
          aria-label={t("close")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Denied — small note
  if (state === "denied") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[#F4F3EF] rounded-[8px] text-[11px] text-[#6B6A66]">
        <BellOff className="w-3.5 h-3.5 shrink-0" />
        <span>{t("denied")}</span>
      </div>
    );
  }

  return null;
}
