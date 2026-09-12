"use client";

// ─── Render dos SELOS/CORES da agenda (cliente) ────────────────────────────────
// Mapeia os dados serializáveis de AppointmentVisual para ícones lucide + cor
// semântica + rótulo i18n. Acessibilidade: SEMPRE cor + ícone + aria-label (nunca
// só cor). Padrão Google Calendar: faixa lateral = categoria; selos = estado/pagto.

import { useTranslations } from "next-intl";
import {
  Check,
  Hourglass,
  Clock,
  UserCheck,
  CircleCheck,
  X,
  AlertTriangle,
  CircleDollarSign,
  DollarSign,
  Undo2,
  CircleAlert,
  RefreshCw,
  Video,
  Stethoscope,
  Activity,
  HeartPulse,
  FlaskConical,
  TestTube,
  Microscope,
  Package,
  Settings,
  ClipboardList,
  FileText,
  Briefcase,
  Calendar,
  User,
  Brain,
  Circle,
  type LucideIcon,
} from "lucide-react";
import type {
  AppointmentStatusKind,
  PaymentBadgeKind,
} from "@/modules/schedule/appointment-visuals";

// ── Tons semânticos (texto + fundo), coerentes com a paleta da casa ────────────
type Tone = "green" | "neutral" | "red" | "amber" | "blue";

const TONE: Record<Tone, { fg: string; bg: string }> = {
  green:   { fg: "#0F6E56", bg: "#E1F5EE" },
  neutral: { fg: "#6B6A66", bg: "#F0EFEB" },
  red:     { fg: "#B42318", bg: "#FDECEA" },
  amber:   { fg: "#8A5A06", bg: "#FAEEDA" },
  blue:    { fg: "#2A7BC1", bg: "#EAF3FB" },
};

// ── Estado do agendamento -> ícone + tom + chave i18n ──────────────────────────
const STATUS_META: Record<
  AppointmentStatusKind,
  { Icon: LucideIcon; tone: Tone; labelKey: string }
> = {
  pending:          { Icon: Hourglass,     tone: "neutral", labelKey: "pending" },
  scheduled:        { Icon: Clock,         tone: "neutral", labelKey: "scheduled" },
  confirmed:        { Icon: Check,         tone: "green",   labelKey: "confirmed" },
  checked_in:       { Icon: UserCheck,     tone: "green",   labelKey: "checked_in" },
  in_progress:      { Icon: Activity,      tone: "blue",    labelKey: "in_progress" },
  completed:        { Icon: CircleCheck,   tone: "green",   labelKey: "completed" },
  cancelled:        { Icon: X,             tone: "red",     labelKey: "cancelled" },
  cancelled_notice: { Icon: X,             tone: "red",     labelKey: "cancelled" },
  late_cancel:      { Icon: X,             tone: "red",     labelKey: "cancelled" },
  no_show:          { Icon: AlertTriangle, tone: "red",     labelKey: "no_show" },
};

// ── Selo de pagamento -> ícone + tom + chave i18n ──────────────────────────────
const PAYMENT_META: Record<
  PaymentBadgeKind,
  { Icon: LucideIcon; tone: Tone; labelKey: string }
> = {
  paid:     { Icon: CircleDollarSign, tone: "green",   labelKey: "paid" },
  partial:  { Icon: DollarSign,       tone: "amber",   labelKey: "partial" },
  refunded: { Icon: Undo2,            tone: "neutral", labelKey: "refunded" },
  pending:  { Icon: CircleAlert,      tone: "amber",   labelKey: "pending" },
};

// ── Ícone da categoria: nome tabler (no banco) -> componente lucide equivalente ─
const TABLER_TO_LUCIDE: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  activity: Activity,
  "heart-rate-monitor": Activity,
  heartbeat: HeartPulse,
  "heart-pulse": HeartPulse,
  flask: FlaskConical,
  "flask-2": FlaskConical,
  "test-pipe": TestTube,
  microscope: Microscope,
  package: Package,
  packages: Package,
  box: Package,
  settings: Settings,
  "settings-2": Settings,
  clipboard: ClipboardList,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
  "file-description": FileText,
  notes: FileText,
  briefcase: Briefcase,
  calendar: Calendar,
  "calendar-event": Calendar,
  user: User,
  brain: Brain,
};

/** Resolve o componente de ícone da categoria (fallback: círculo preenchido). */
export function categoryIconComponent(name: string | null): LucideIcon {
  if (!name) return Circle;
  return TABLER_TO_LUCIDE[name.trim().toLowerCase()] ?? Circle;
}

// ── Selo compacto (só ícone) para os cards da grade ────────────────────────────
function IconBadge({
  Icon,
  tone,
  label,
  size = 12,
}: {
  Icon: LucideIcon;
  tone: Tone;
  label: string;
  size?: number;
}) {
  const c = TONE[tone];
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size + 6,
        height: size + 6,
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        flexShrink: 0,
      }}
    >
      <Icon style={{ width: size - 2, height: size - 2 }} aria-hidden="true" />
    </span>
  );
}

/** Selo de ESTADO do agendamento (compacto, ícone-only) para os cards. */
export function StatusBadge({
  status,
  size = 12,
}: {
  status: AppointmentStatusKind;
  size?: number;
}) {
  const t = useTranslations("schedule.badges.status");
  const meta = STATUS_META[status] ?? STATUS_META.scheduled;
  return <IconBadge Icon={meta.Icon} tone={meta.tone} label={t(meta.labelKey)} size={size} />;
}

/** Selo de PAGAMENTO (compacto, ícone-only) para os cards. */
export function PaymentBadge({
  kind,
  size = 12,
}: {
  kind: PaymentBadgeKind;
  size?: number;
}) {
  const t = useTranslations("schedule.badges.payment");
  const meta = PAYMENT_META[kind];
  return <IconBadge Icon={meta.Icon} tone={meta.tone} label={t(meta.labelKey)} size={size} />;
}

/** Selo de PACOTE (pill de texto "usadas/total"; laranja + "Renovar" na última). */
export function PackageBadge({
  badge,
  size = 12,
}: {
  badge: { used: number; total: number; renew: boolean };
  size?: number;
}) {
  const t = useTranslations("schedule.badges");
  const c = badge.renew ? TONE.amber : TONE.neutral;
  const aria = t(badge.renew ? "packageRenewAria" : "packageAria", { used: badge.used, total: badge.total });
  return (
    <span
      role="img"
      aria-label={aria}
      title={aria}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        background: c.bg,
        color: c.fg,
        borderRadius: 999,
        padding: "1px 6px",
        fontSize: size - 2,
        fontWeight: 500,
        lineHeight: 1.4,
        flexShrink: 0,
      }}
    >
      {badge.renew ? (
        <RefreshCw style={{ width: size - 3, height: size - 3 }} aria-hidden="true" />
      ) : (
        <Package style={{ width: size - 3, height: size - 3 }} aria-hidden="true" />
      )}
      {badge.used}/{badge.total}
      {badge.renew ? ` ${t("renew")}` : ""}
    </span>
  );
}

/** Ícone de sessão ONLINE (compacto) para os cards. */
export function OnlineBadge({ size = 12 }: { size?: number }) {
  const t = useTranslations("schedule.badges");
  return <IconBadge Icon={Video} tone="blue" label={t("online")} size={size} />;
}

/**
 * Linha de selos do card (online + pagamento + estado). Recebe o `visual` já
 * resolvido. Não renderiza nada quando não há visual.
 */
export function CardBadges({
  visual,
  size = 12,
}: {
  visual:
    | {
        status: AppointmentStatusKind;
        paymentBadge: PaymentBadgeKind | null;
        packageBadge: { used: number; total: number; renew: boolean } | null;
        isOnline: boolean;
      }
    | null
    | undefined;
  size?: number;
}) {
  if (!visual) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {visual.isOnline && <OnlineBadge size={size} />}
      {visual.paymentBadge && <PaymentBadge kind={visual.paymentBadge} size={size} />}
      {visual.packageBadge && <PackageBadge badge={visual.packageBadge} size={size} />}
      <StatusBadge status={visual.status} size={size} />
    </span>
  );
}

// ── Legenda da agenda ──────────────────────────────────────────────────────────
type LegendCategory = { id: string; name: string; color: string; icon: string | null };

/** Item de legenda com ícone + cor + rótulo (nunca só cor). */
function LegendItem({
  Icon,
  color,
  bg,
  label,
}: {
  Icon: LucideIcon;
  color: string;
  bg?: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-[6px]">
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{ width: 18, height: 18, background: bg ?? "transparent", color }}
      >
        <Icon style={{ width: 12, height: 12 }} aria-hidden="true" />
      </span>
      <span className="text-[11px] text-[#6B6A66] dark:text-[#9E9C97]">{label}</span>
    </span>
  );
}

/**
 * Legenda exibida na tela /schedule: categorias (cor + nome) e os selos de
 * estado e pagamento. Multi-tenant: as categorias vêm do banco da clínica.
 */
export function ScheduleLegend({ categories }: { categories: LegendCategory[] }) {
  const t = useTranslations("schedule.badges");
  const tStatus = useTranslations("schedule.badges.status");
  const tPay = useTranslations("schedule.badges.payment");

  // Estados representativos na legenda (variantes de cancelamento sob "Cancelado").
  const statusList: AppointmentStatusKind[] = [
    "scheduled",
    "confirmed",
    "checked_in",
    "completed",
    "cancelled",
    "no_show",
  ];
  const paymentList: PaymentBadgeKind[] = ["paid", "partial", "refunded", "pending"];

  return (
    <details className="bg-white dark:bg-[#111827] border border-black/[.07] dark:border-white/[.07] rounded-[12px] px-[14px] py-[10px]">
      <summary className="cursor-pointer text-[12px] font-medium text-[#0F1A2E] dark:text-[#E8E6E2] select-none">
        {t("legendTitle")}
      </summary>

      <div className="mt-[12px] flex flex-col gap-[14px]">
        {categories.length > 0 && (
          <div>
            <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[7px]">
              {t("categoriesTitle")}
            </p>
            <div className="flex flex-wrap gap-x-[16px] gap-y-[8px]">
              {categories.map((c) => {
                const Icon = categoryIconComponent(c.icon);
                return (
                  <span key={c.id} className="inline-flex items-center gap-[6px]">
                    <span
                      aria-hidden="true"
                      className="inline-block rounded-[3px]"
                      style={{ width: 4, height: 14, background: c.color }}
                    />
                    <Icon style={{ width: 13, height: 13, color: c.color }} aria-hidden="true" />
                    <span className="text-[11px] text-[#6B6A66] dark:text-[#9E9C97]">{c.name}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[7px]">
            {t("statusTitle")}
          </p>
          <div className="flex flex-wrap gap-x-[16px] gap-y-[8px]">
            {statusList.map((s) => {
              const meta = STATUS_META[s];
              return (
                <LegendItem
                  key={s}
                  Icon={meta.Icon}
                  color={TONE[meta.tone].fg}
                  bg={TONE[meta.tone].bg}
                  label={tStatus(meta.labelKey)}
                />
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-medium tracking-[.08em] uppercase text-[#A09E98] mb-[7px]">
            {t("paymentTitle")}
          </p>
          <div className="flex flex-wrap gap-x-[16px] gap-y-[8px]">
            {paymentList.map((k) => {
              const meta = PAYMENT_META[k];
              return (
                <LegendItem
                  key={k}
                  Icon={meta.Icon}
                  color={TONE[meta.tone].fg}
                  bg={TONE[meta.tone].bg}
                  label={tPay(meta.labelKey)}
                />
              );
            })}
            <LegendItem Icon={Package} color={TONE.neutral.fg} bg={TONE.neutral.bg} label={t("packageLegend")} />
            <LegendItem Icon={RefreshCw} color={TONE.amber.fg} bg={TONE.amber.bg} label={t("renew")} />
            <LegendItem Icon={Video} color={TONE.blue.fg} bg={TONE.blue.bg} label={t("online")} />
          </div>
        </div>
      </div>
    </details>
  );
}
