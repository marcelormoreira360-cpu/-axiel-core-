// ─── Time grid constants ──────────────────────────────────────────────────────
export const HOUR_HEIGHT  = 64;
export const START_HOUR   = 6;
export const END_HOUR     = 22;
export const TOTAL_HOURS  = END_HOUR - START_HOUR;
export const GRID_HEIGHT  = TOTAL_HOURS * HOUR_HEIGHT;   // 1024 px
export const TIME_COL_W   = 64;                          // px
export const HEADER_H     = 56;                          // px
export const BODY_H       = 640;                         // px (visible + scrollável)
export const HOUR_LABELS  = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

export function apptStyle(startsAt: string, duration: number) {
  const d = new Date(startsAt);
  const startMins = d.getHours() * 60 + d.getMinutes() - START_HOUR * 60;
  return {
    top:    Math.max(0, (startMins / 60) * HOUR_HEIGHT),
    height: Math.max((duration / 60) * HOUR_HEIGHT, 24),
  };
}

export function getNowOffset(): number | null {
  const now  = new Date();
  const mins = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
  if (mins < 0 || mins > TOTAL_HOURS * 60) return null;
  return (mins / 60) * HOUR_HEIGHT;
}

export type ConfirmLinkAction = (formData: FormData) => Promise<{ url?: string; phone?: string | null; email?: string | null; patientName?: string; error?: string }>;
export type EmailLinkAction = (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
