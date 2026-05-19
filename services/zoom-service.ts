import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const ZOOM_AUTH_URL  = "https://zoom.us/oauth/authorize";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_API       = "https://api.zoom.us/v2";

function clientId()     { return process.env.ZOOM_CLIENT_ID ?? ""; }
function clientSecret() { return process.env.ZOOM_CLIENT_SECRET ?? ""; }
function redirectUri()  { return `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/zoom/callback`; }

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function buildZoomAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     clientId(),
    redirect_uri:  redirectUri(),
    state,
  });
  return `${ZOOM_AUTH_URL}?${params}`;
}

export async function exchangeZoomCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const credentials = Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
  const res = await fetch(ZOOM_TOKEN_URL, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri() }),
  });
  if (!res.ok) throw new Error(`Zoom token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshZoomToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const credentials = Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
  const res = await fetch(ZOOM_TOKEN_URL, {
    method:  "POST",
    headers: {
      Authorization:  `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(`Zoom token refresh failed: ${await res.text()}`);
  return res.json();
}

// ── Token management ──────────────────────────────────────────────────────────

export async function saveZoomIntegration(clinicId: string, tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}) {
  const supabase = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Fetch Zoom user profile
  let zoomUserId: string | null = null;
  let zoomUserEmail: string | null = null;
  try {
    const me = await fetch(`${ZOOM_API}/users/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await me.json();
    zoomUserId    = profile.id ?? null;
    zoomUserEmail = profile.email ?? null;
  } catch { /* non-blocking */ }

  await supabase.from("zoom_integrations").upsert({
    clinic_id:        clinicId,
    access_token:     tokens.access_token,
    refresh_token:    tokens.refresh_token,
    token_expires_at: expiresAt,
    zoom_user_id:     zoomUserId,
    zoom_user_email:  zoomUserEmail,
  }, { onConflict: "clinic_id" });
}

export async function getZoomAccessToken(clinicId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("zoom_integrations")
    .select("access_token, refresh_token, token_expires_at")
    .eq("clinic_id", clinicId).maybeSingle();

  if (!data) return null;

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at) : null;
  if (expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000 && data.refresh_token) {
    const refreshed = await refreshZoomToken(data.refresh_token);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase.from("zoom_integrations")
      .update({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token, token_expires_at: newExpiry })
      .eq("clinic_id", clinicId);
    return refreshed.access_token;
  }

  return data.access_token;
}

export async function disconnectZoom(clinicId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("zoom_integrations").delete().eq("clinic_id", clinicId);
}

export async function getZoomIntegrationStatus(clinicId: string): Promise<{ connected: boolean; email: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("zoom_integrations")
    .select("zoom_user_email").eq("clinic_id", clinicId).maybeSingle();
  return { connected: !!data, email: data?.zoom_user_email ?? null };
}

// ── Meeting management ────────────────────────────────────────────────────────

export async function createZoomMeeting(clinicId: string, meeting: {
  topic: string;
  startIso: string;
  durationMinutes: number;
  agenda?: string;
}): Promise<{ meeting_id: string; join_url: string; start_url: string } | null> {
  const token = await getZoomAccessToken(clinicId);
  if (!token) return null;

  const res = await fetch(`${ZOOM_API}/users/me/meetings`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic:      meeting.topic,
      type:       2, // scheduled
      start_time: new Date(meeting.startIso).toISOString(),
      duration:   meeting.durationMinutes,
      agenda:     meeting.agenda ?? "",
      settings: {
        host_video:      true,
        participant_video: true,
        waiting_room:    true,
        auto_recording:  "none",
      },
    }),
  });

  if (!res.ok) { console.error("Zoom meeting creation failed", await res.text()); return null; }
  const created = await res.json();
  return {
    meeting_id: String(created.id),
    join_url:   created.join_url,
    start_url:  created.start_url,
  };
}

export async function deleteZoomMeeting(clinicId: string, meetingId: string) {
  const token = await getZoomAccessToken(clinicId);
  if (!token) return;
  await fetch(`${ZOOM_API}/meetings/${meetingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
