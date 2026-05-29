import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createLogger } from "@/lib/logger";

const log = createLogger("google-calendar");
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
  const { token } = await getGoogleTokenAndCalendarId(clinicId);
  return token;
}

// PERF-02: internal helper that fetches access_token + calendar_id in a single query,
// then handles token refresh if needed. Callers that need both values avoid a second round-trip.
async function getGoogleTokenAndCalendarId(
  clinicId: string
): Promise<{ token: string | null; calendarId: string }> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("calendar_integrations")
    .select("access_token, refresh_token, token_expires_at, calendar_id")
    .eq("clinic_id", clinicId)
    .eq("provider", "google")
    .maybeSingle();

  if (!data) return { token: null, calendarId: "primary" };

  const calendarId = (data.calendar_id as string | null) ?? "primary";

  // BUG-04: also refresh when token_expires_at is NULL (first-time token, no expiry recorded)
  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at) : null;
  if ((!expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000) && data.refresh_token) {
    try {
      const refreshed = await refreshGoogleToken(data.refresh_token);
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase.from("calendar_integrations")
        .update({ access_token: refreshed.access_token, token_expires_at: newExpiry })
        .eq("clinic_id", clinicId)
        .eq("provider", "google");
      return { token: refreshed.access_token, calendarId };
    } catch (e) {
      log.error("token refresh failed", e);
      // Fall through — return existing token (may be expired)
    }
  }

  return { token: data.access_token as string | null, calendarId };
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
  // PERF-02: single query for both token and calendar_id
  const { token, calendarId } = await getGoogleTokenAndCalendarId(clinicId);
  if (!token) return null;

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
  if (!res.ok) { log.error("event creation failed", { body: await res.text() }); return null; }
  const created = await res.json();
  return created.id ?? null;
}

export async function deleteGoogleCalendarEvent(clinicId: string, eventId: string) {
  // PERF-02: single query for both token and calendar_id
  const { token, calendarId } = await getGoogleTokenAndCalendarId(clinicId);
  if (!token) return;
  await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateGoogleCalendarEvent(
  clinicId: string,
  eventId: string,
  event: {
    summary: string;
    description?: string;
    startIso: string;
    durationMinutes: number;
    attendeeEmail?: string | null;
    location?: string;
    meetLink?: string;
  }
): Promise<void> {
  // PERF-02: single query for both token and calendar_id
  const { token, calendarId } = await getGoogleTokenAndCalendarId(clinicId);
  if (!token) return;

  const startDt = new Date(event.startIso);
  const endDt = new Date(startDt.getTime() + event.durationMinutes * 60 * 1000);

  const body: Record<string, unknown> = {
    summary: event.summary,
    description: event.description ?? "",
    start: { dateTime: startDt.toISOString() },
    end: { dateTime: endDt.toISOString() },
  };
  if (event.attendeeEmail) body.attendees = [{ email: event.attendeeEmail }];
  if (event.location) body.location = event.location;
  if (event.meetLink) {
    body.description = `${body.description}\n\nLink: ${event.meetLink}`.trim();
  }

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    log.error("event update failed", { body: await res.text() });
  }
}

// ── Bidirectional sync (Google → AXIEL) ──────────────────────────────────────

interface GoogleCalendarEvent {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  updated?: string;
}

interface GoogleEventListResponse {
  items?: GoogleCalendarEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

/**
 * Syncs Google Calendar changes → AXIEL appointments.
 *
 * Uses Google's incremental sync (syncToken) so only changed events are fetched.
 * On the first run (no stored syncToken), fetches events for the next 60 days.
 *
 * Returns a summary of what was processed.
 */
export async function syncGoogleCalendarToAxiel(clinicId: string): Promise<{
  updated: number;
  cancelled: number;
  errors: number;
}> {
  const token = await getGoogleAccessToken(clinicId);
  if (!token) return { updated: 0, cancelled: 0, errors: 0 };

  const supabase = createSupabaseAdminClient();
  const { data: integration } = await supabase
    .from("calendar_integrations")
    .select("calendar_id, sync_token")
    .eq("clinic_id", clinicId)
    .eq("provider", "google")
    .maybeSingle();

  if (!integration) return { updated: 0, cancelled: 0, errors: 0 };

  const calendarId = integration.calendar_id ?? "primary";
  const existingSyncToken = (integration as { sync_token?: string | null }).sync_token ?? null;

  // Build the list URL — incremental if we have a syncToken, full if not
  const params = new URLSearchParams({ maxResults: "250", singleEvents: "true" });
  if (existingSyncToken) {
    params.set("syncToken", existingSyncToken);
  } else {
    // First sync: fetch next 60 days
    params.set("timeMin", new Date().toISOString());
    params.set(
      "timeMax",
      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    );
    params.set("orderBy", "startTime");
  }

  let updated = 0;
  let cancelled = 0;
  let errors = 0;
  let nextSyncToken: string | null = null;
  let pageToken: string | undefined;

  try {
    // Paginate through all changed events
    do {
      if (pageToken) params.set("pageToken", pageToken);

      const res = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 410 Gone = syncToken expired, reset to full sync
      if (res.status === 410) {
        await supabase
          .from("calendar_integrations")
          .update({ sync_token: null })
          .eq("clinic_id", clinicId)
          .eq("provider", "google");
        return syncGoogleCalendarToAxiel(clinicId); // retry without syncToken
      }

      if (!res.ok) {
        log.error("list events failed", { status: res.status, body: await res.text() });
        break;
      }

      const data = (await res.json()) as GoogleEventListResponse;
      nextSyncToken = data.nextSyncToken ?? null;
      pageToken = data.nextPageToken;

      for (const event of data.items ?? []) {
        try {
          // Find the matching AXIEL appointment by google_event_id
          const { data: appointment } = await supabase
            .from("appointments")
            .select("id, starts_at, duration_minutes, status")
            .eq("google_event_id", event.id)
            .eq("clinic_id", clinicId)
            .maybeSingle();

          if (!appointment) continue; // Event not linked to an AXIEL appointment

          if (event.status === "cancelled") {
            // Cancel the appointment if not already cancelled
            if (appointment.status !== "cancelled" && appointment.status !== "no_show") {
              await supabase
                .from("appointments")
                .update({ status: "cancelled", notes: "Cancelado via Google Calendar" })
                .eq("id", appointment.id);
              cancelled++;
            }
          } else if (event.start?.dateTime) {
            // Check if the time changed
            const googleStart = new Date(event.start.dateTime);
            const axielStart = new Date(appointment.starts_at as string);

            if (Math.abs(googleStart.getTime() - axielStart.getTime()) > 60_000) {
              // Time changed by more than 1 minute — update appointment
              const googleEnd = event.end?.dateTime ? new Date(event.end.dateTime) : null;
              const durationMinutes = googleEnd
                ? Math.round((googleEnd.getTime() - googleStart.getTime()) / 60_000)
                : (appointment.duration_minutes as number);

              await supabase
                .from("appointments")
                .update({
                  starts_at: googleStart.toISOString(),
                  duration_minutes: durationMinutes,
                })
                .eq("id", appointment.id);
              updated++;
            }
          }
        } catch (eventErr) {
          log.error("error processing event", eventErr, { event_id: event.id });
          errors++;
        }
      }
    } while (pageToken);

    // Persist the new syncToken for next incremental sync
    if (nextSyncToken) {
      await supabase
        .from("calendar_integrations")
        .update({
          sync_token: nextSyncToken,
          last_synced_at: new Date().toISOString(),
        })
        .eq("clinic_id", clinicId)
        .eq("provider", "google");
    }
  } catch (err) {
    log.error("sync error", err);
    errors++;
  }

  return { updated, cancelled, errors };
}
