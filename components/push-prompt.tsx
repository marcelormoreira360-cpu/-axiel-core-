"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, X } from "lucide-react";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function PushPrompt() {
  const t = useTranslations("common.push");
  const [state, setState] = useState<PermissionState>("default");
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as PermissionState);

    // Check if already dismissed
    const saved = localStorage.getItem("push-prompt-dismissed");
    if (saved) setDismissed(true);
  }, []);

  async function handleEnable() {
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setState(permission as PermissionState);

      if (permission !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent.slice(0, 200),
        }),
      });
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("push-prompt-dismissed", "1");
  }

  // Don't show if: unsupported, already granted/denied, or dismissed
  if (state !== "default" || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-[320px] bg-white rounded-2xl border border-black/[.09] shadow-xl p-4 flex gap-3 items-start">
      <div className="shrink-0 w-9 h-9 rounded-xl bg-[#0F6E56]/10 flex items-center justify-center">
        <Bell className="h-4 w-4 text-[#0F6E56]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[#0F1A2E] leading-tight">
          {t("title")}
        </p>
        <p className="text-[11px] text-black/50 mt-0.5 leading-relaxed">
          {t("description")}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleEnable}
            disabled={loading}
            className="flex-1 rounded-xl bg-[#0F1A2E] text-white text-[12px] font-semibold py-2 hover:bg-black transition disabled:opacity-50"
          >
            {loading ? t("enabling") : t("enable")}
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-xl border border-black/[.10] text-black/50 text-[12px] px-3 py-2 hover:bg-black/[.04] transition"
          >
            {t("notNow")}
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-black/25 hover:text-black/50 transition"
        aria-label={t("close")}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Push settings toggle (for use in settings page) ──────────────────────────
export function PushSettingsToggle() {
  const t = useTranslations("common.push");
  const [state, setState] = useState<PermissionState>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as PermissionState);

    // Check current subscription
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function handleToggle() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      if (existing) {
        // Unsubscribe
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setSubscribed(false);
      } else {
        const permission = await Notification.requestPermission();
        setState(permission as PermissionState);
        if (permission !== "granted") return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        });
        const json = sub.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
        setSubscribed(true);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  if (state === "unsupported") {
    return <p className="text-xs text-black/40">{t("unsupported")}</p>;
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] font-medium text-[#0F1A2E]">{t("settingsTitle")}</p>
        <p className="text-[11px] text-black/45">
          {state === "denied"
            ? t("denied")
            : subscribed
            ? t("active")
            : t("subtitle")}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading || state === "denied"}
        className={[
          "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-50",
          subscribed
            ? "bg-[#0F6E56]/10 text-[#0F6E56] hover:bg-[#0F6E56]/20"
            : "bg-[#0F1A2E] text-white hover:bg-black",
        ].join(" ")}
      >
        {subscribed ? <><BellOff className="h-3.5 w-3.5" /> {t("disable")}</> : <><Bell className="h-3.5 w-3.5" /> {loading ? "…" : t("enable")}</>}
      </button>
    </div>
  );
}
