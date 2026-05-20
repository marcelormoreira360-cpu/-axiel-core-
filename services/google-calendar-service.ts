import { createSupabaseAdminClient } from "@/lib/supabase-admin";
const GOOGLE_AUTH_URL    = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL   = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = "https://www.googleapis.com/auth/calendar.events";

function clientId()     { return process.env.GOOGLE_CLIENT_ID ?? ""; }
function clientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? ""; }
function redirectUri()  { return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/callback`; }

// ── OAuth ────────────────────────────────────────────────────────────────────

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     clientId(),
    redirect_uri:  redirectUri(),
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     clientId(),
      client_secret: clientSecret(),
      redirect_uri:  redirectUri(),
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId(),
      client_secret: clientSecret(),
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json();
}

// ── Token management ─────────────────────────────────────────────────────────

export async function saveGoogleIntegration(clinicId: string, tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}) {
  const supabase = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase.from("calendar_integrations").upsert({
    clinic_id:       clinicId,
    provider:        "google",
    access_token:    tokens.access_token,
    refresh_token:   tokens.refresh_token,
    token_expires_at: expiresAt,
  }, { onConflict: "clinic_id,provider" });
}

export async function getGoogleAccessToken(clinicId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("calendar_integrations")
    .select("access_token, refresh_token, token_expires_at")
    .eq("clinic_id", clinicId)
    .eq("provider", "google")
    .maybeSingle();

  if (!data) return null;

  // Refresh if expired (with 5-min buffer)
  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at) : null;
  if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000 && data.refresh_token) {
    const refreshed = await refreshGoogleToken(data.refresh_token);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase.from("calendar_integrations")
      .update({ access_token: refreshed.access_token, token_expires_at: newExpiry })
      .eq("clinic_id", clinicId)
      .eq("provider", "google");
    return refreshed.access_token;
  }

  return data.access_token;
}

export async function disconnectGoogle(clinicId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("calendar_integrations").delete()
    .eq("clinic_id", clinicId).eq("provider", "google");
}

export async function getGoogleIntegrationStatus(clinicId: string): Promise<{ connected: boolean; calendar_id: string | null }> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("calendar_integrations")
    .select("calendar_id").eq("clinic_id", clinicId).eq("provider", "google").maybeSingle();
  return { connected: !!data, calendar_id: data?.calendar_id ?? null };
}

// ── Calendar events ───────────────────────────────────────────────────────────

export async function createGoogleCalendarEvent(clinicId: string, event: {
  summary: string;
  description?: string;
  startIso: string;
  durationMinutes: number;
  attendeeEmail?: string | null;
  location?: string;
  meetLink?: string;
}): Promise<string | null> {
  const token = await getGoogleAccessToken(clinicId);
  if (!token) return null;

  const supabase = createSupabaseAdminClient();
  const { data: integration } = await supabase.from("calendar_integrations")
    .select("calendar_id").eq("clinic_id", clinicId).eq("provider", "google").maybeSingle();
  const calendarId = integration?.calendar_id ?? "primary";

  const startDt = new Date(event.startIso);
  const endDt   = new Date(startDt.getTime() + event.durationMinutes * 60 * 1000);

  const body: Record<string, unknown> = {
    summary:     event.summary,
    description: event.description ?? "",
    start: { dateTime: startDt.toISOString() },
    end:   { dateTime: endDt.toISOString() },
  };
  if (event.attendeeEmail) {
    body.attendees = [{ email: event.attendeeEmail }];
  }
  if (event.location) body.location = event.location;
  if (event.meetLink) {
    body.description = `${body.description}\n\nLink: ${event.meetLink}`.trim();
  }

  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) { console.error("Google Calendar event creation failed", await res.text()); return null; }
  const created = await res.json();
  return created.id ?? null;
}

export async function deleteGoogleCalendarEvent(clinicId: string, eventId: string) {
  const token = await getGoogleAccessToken(clinicId);
  if (!token) return;
  const supabase = createSupabaseAdminClient();
  const { data: integration } = await supabase.from("calendar_integrations")
    .select("calendar_id").eq("clinic_id", clinicId).eq("provider", "google").maybeSingle();
  const calendarId = integration?.calendar_id ?? "primary";
  await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
