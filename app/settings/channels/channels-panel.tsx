"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/card";

// Espelha ChannelConnectionState de @/lib/meta-channel-status. Redeclarado aqui
// (e não importado) porque aquele módulo é "server-only" e não pode entrar no
// bundle do cliente.
type ChannelConnectionState = "connected" | "configured" | "disconnected";
type Tone = "green" | "amber" | "gray";

type ChannelsStatus = {
  fb: { name: string | null; state: ChannelConnectionState; subscribedMessages: boolean } | null;
  ig: { username: string | null; state: ChannelConnectionState; subscribedMessages: boolean } | null;
};

type Props = {
  fbPageId: string | null;
  igId: string | null;
  waPhoneId: string | null;
  twilioNumber: string | null;
};

function toneFor(state: ChannelConnectionState): Tone {
  if (state === "connected") return "green";
  if (state === "configured") return "amber";
  return "gray";
}

function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  const styles: Record<Tone, string> = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-black/5 text-black/45",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}>
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-[13px] text-black/45">{label}</span>
      <span className="text-[13px] font-medium text-[#0F1A2E] text-right break-all">{value}</span>
    </div>
  );
}

export function ChannelsPanel({ fbPageId, igId, waPhoneId, twilioNumber }: Props) {
  const t = useTranslations("settings.channels");
  const [status, setStatus] = useState<ChannelsStatus | null>(null);

  useEffect(() => {
    // Sem canal Meta configurado não há o que verificar na Graph API.
    if (!fbPageId && !igId) return;
    let active = true;
    fetch("/api/settings/channels/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) setStatus(data as ChannelsStatus);
      })
      .catch(() => {
        /* mantém o rótulo honesto de "verificando" — sem falso "connected" */
      });
    return () => {
      active = false;
    };
  }, [fbPageId, igId]);

  const fb = status?.fb ?? null;
  const ig = status?.ig ?? null;

  // Antes de a resposta chegar, o estado honesto é "configured", que na UI
  // aparece como "Configured (verifying…)".
  const fbState: ChannelConnectionState = fb?.state ?? "configured";
  const igState: ChannelConnectionState = ig?.state ?? "configured";

  const statusLabel = (state: ChannelConnectionState) =>
    state === "connected"
      ? t("statusConnected")
      : state === "configured"
        ? t("statusConfigured")
        : t("statusNotConnected");

  const hasAny = Boolean(fbPageId || igId || waPhoneId);

  if (!hasAny) {
    return (
      <Card className="p-6">
        <p className="text-sm text-black/55">{t("empty")}</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {fbPageId && (
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[#0F1A2E]">{t("facebookTitle")}</h2>
            <StatusPill tone={toneFor(fbState)} label={statusLabel(fbState)} />
          </div>
          <div className="divide-y divide-black/[.06]">
            {fb?.name && <Row label={t("labelName")} value={fb.name} />}
            <Row label={t("labelPageId")} value={fbPageId} />
            <Row
              label={t("labelWebhook")}
              value={fb?.subscribedMessages ? t("webhookSubscribed") : t("webhookNotSubscribed")}
            />
          </div>
        </Card>
      )}

      {igId && (
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[#0F1A2E]">{t("instagramTitle")}</h2>
            <StatusPill tone={toneFor(igState)} label={statusLabel(igState)} />
          </div>
          <div className="divide-y divide-black/[.06]">
            {ig?.username && <Row label={t("labelAccount")} value={`@${ig.username}`} />}
            <Row label={t("labelAccountId")} value={igId} />
            <Row
              label={t("labelWebhook")}
              value={ig?.subscribedMessages ? t("webhookSubscribed") : t("webhookNotSubscribed")}
            />
          </div>
        </Card>
      )}

      {waPhoneId && (
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[#0F1A2E]">{t("whatsappTitle")}</h2>
            <StatusPill tone="green" label={t("statusConnected")} />
          </div>
          <div className="divide-y divide-black/[.06]">
            {twilioNumber && <Row label={t("labelNumber")} value={twilioNumber} />}
            <Row label={t("labelPhoneNumberId")} value={waPhoneId} />
          </div>
        </Card>
      )}
    </div>
  );
}
