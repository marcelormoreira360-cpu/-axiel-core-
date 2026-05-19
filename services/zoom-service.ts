const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_API       = "https://api.zoom.us/v2";

function accountId()    { return process.env.ZOOM_ACCOUNT_ID ?? ""; }
function clientId()     { return process.env.ZOOM_CLIENT_ID ?? ""; }
function clientSecret() { return process.env.ZOOM_CLIENT_SECRET ?? ""; }

// ── Server-to-Server OAuth token ─────────────────────────────────────────────

async function getZoomAccessToken(): Promise<string | null> {
  if (!accountId() || !clientId() || !clientSecret()) return null;

  const credentials = Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
  const res = await fetch(
    `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${accountId()}`,
    {
      method:  "POST",
      headers: {
        Authorization:  `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!res.ok) { console.error("Zoom S2S token failed", await res.text()); return null; }
  const data = await res.json();
  return data.access_token ?? null;
}

// ── Status ────────────────────────────────────────────────────────────────────

export function getZoomIntegrationStatus(): { connected: boolean } {
  return { connected: !!(accountId() && clientId() && clientSecret()) };
}

// ── Meeting management ────────────────────────────────────────────────────────

export async function createZoomMeeting(_clinicId: string, meeting: {
  topic: string;
  startIso: string;
  durationMinutes: number;
  agenda?: string;
}): Promise<{ meeting_id: string; join_url: string; start_url: string } | null> {
  const token = await getZoomAccessToken();
  if (!token) return null;

  const res = await fetch(`${ZOOM_API}/users/me/meetings`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic:      meeting.topic,
      type:       2,
      start_time: new Date(meeting.startIso).toISOString(),
      duration:   meeting.durationMinutes,
      agenda:     meeting.agenda ?? "",
      settings: {
        host_video:       true,
        participant_video: true,
        waiting_room:     false,
        join_before_host: true,
        auto_recording:   "none",
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

export async function deleteZoomMeeting(_clinicId: string, meetingId: string) {
  const token = await getZoomAccessToken();
  if (!token) return;
  await fetch(`${ZOOM_API}/meetings/${meetingId}`, {
    method:  "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
