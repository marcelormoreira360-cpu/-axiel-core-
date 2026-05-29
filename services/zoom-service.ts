const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_API       = "https://api.zoom.us/v2";

function accountId()    { return process.env.ZOOM_ACCOUNT_ID ?? ""; }
function clientId()     { return process.env.ZOOM_CLIENT_ID ?? ""; }
function clientSecret() { return process.env.ZOOM_CLIENT_SECRET ?? ""; }

// ── Per-clinic Zoom credentials (stored in clinic_settings.settings JSONB) ────
type ZoomCreds = { account_id: string; client_id: string; client_secret: string };

async function getClinicZoomCreds(clinicId: string): Promise<ZoomCreds | null> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("clinic_settings")
      .select("settings")
      .eq("clinic_id", clinicId)
      .maybeSingle();
    const s = data?.settings as Record<string, unknown> | null;
    const c = s?.zoom as ZoomCreds | null;
    if (c?.account_id && c?.client_id && c?.client_secret) return c;
  } catch { /* fall through to global env */ }
  return null;
}

// ── Server-to-Server OAuth token ─────────────────────────────────────────────

async function getZoomAccessToken(cliCreds?: ZoomCreds | null): Promise<string | null> {
  const aid = cliCreds?.account_id ?? accountId();
  const cid = cliCreds?.client_id  ?? clientId();
  const cs  = cliCreds?.client_secret ?? clientSecret();
  if (!aid || !cid || !cs) return null;

  const credentials = Buffer.from(`${cid}:${cs}`).toString("base64");
  const res = await fetch(
    `${ZOOM_TOKEN_URL}?grant_type=account_credentials&account_id=${aid}`,
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

// Save per-clinic Zoom credentials to clinic_settings.settings JSONB
export async function saveClinicZoomCredentials(clinicId: string, creds: {
  account_id: string;
  client_id: string;
  client_secret: string;
}): Promise<void> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const current = (existing?.settings ?? {}) as Record<string, unknown>;
  const updated = { ...current, zoom: creds };
  await supabase
    .from("clinic_settings")
    .upsert({ clinic_id: clinicId, settings: updated, updated_at: new Date().toISOString() },
             { onConflict: "clinic_id" });
}

export async function removeClinicZoomCredentials(clinicId: string): Promise<void> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("clinic_settings")
    .select("settings")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  const current = (existing?.settings ?? {}) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { zoom: _removed, ...rest } = current;
  await supabase
    .from("clinic_settings")
    .upsert({ clinic_id: clinicId, settings: rest, updated_at: new Date().toISOString() },
             { onConflict: "clinic_id" });
}

// ── Meeting management ────────────────────────────────────────────────────────

export async function createZoomMeeting(clinicId: string, meeting: {
  topic: string;
  startIso: string;
  durationMinutes: number;
  agenda?: string;
  autoRecord?: boolean; // defaults to true; false = no cloud recording
}): Promise<{ meeting_id: string; join_url: string; start_url: string } | null> {
  const creds = clinicId ? await getClinicZoomCreds(clinicId) : null;
  const token = await getZoomAccessToken(creds);
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
        auto_recording:   meeting.autoRecord === false ? "none" : "cloud",
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
  const creds = clinicId ? await getClinicZoomCreds(clinicId) : null;
  const token = await getZoomAccessToken(creds);
  if (!token) return;
  await fetch(`${ZOOM_API}/meetings/${meetingId}`, {
    method:  "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Update a Zoom meeting's start time and/or duration.
 * Called when an appointment is rescheduled.
 */
export async function updateZoomMeeting(
  clinicId: string,
  meetingId: string,
  updates: { startIso?: string; durationMinutes?: number },
) {
  const creds = clinicId ? await getClinicZoomCreds(clinicId) : null;
  const token = await getZoomAccessToken(creds);
  if (!token) return;

  const body: Record<string, unknown> = {};
  if (updates.startIso)        body.start_time = updates.startIso;
  if (updates.durationMinutes) body.duration   = updates.durationMinutes;
  if (Object.keys(body).length === 0) return;

  await fetch(`${ZOOM_API}/meetings/${meetingId}`, {
    method:  "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}

// ── Recordings ────────────────────────────────────────────────────────────────

export type ZoomRecording = {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  patient_id: string | null;
  zoom_meeting_id: string;
  recording_id: string;
  file_type: string | null;
  file_size: number | null;
  play_url: string | null;
  download_url: string | null;
  recording_start: string | null;
  recording_end: string | null;
  status: string;
  created_at: string;
};

/**
 * Fetch recordings from Zoom API for a specific meeting and upsert into DB.
 * Called manually (e.g. from session page) or after webhook processing.
 */
export async function syncZoomRecordingsForMeeting(
  meetingId: string,
  appointmentId: string,
  clinicId: string,
  patientId: string | null = null,
): Promise<{ synced: number; error: string | null }> {
  const token = await getZoomAccessToken();
  if (!token) return { synced: 0, error: "Zoom não configurado." };

  const res = await fetch(`${ZOOM_API}/meetings/${meetingId}/recordings`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return { synced: 0, error: null }; // no recordings yet
  if (!res.ok) {
    const msg = await res.text();
    console.error("Zoom recordings fetch failed", msg);
    return { synced: 0, error: "Erro ao buscar gravações." };
  }

  const data = await res.json() as {
    recording_files?: Array<{
      id: string;
      file_type: string;
      file_size: number;
      play_url?: string;
      download_url?: string;
      recording_start?: string;
      recording_end?: string;
      status: string;
    }>;
  };

  const files = (data.recording_files ?? []).filter(
    (f) => f.status === "completed" && ["MP4", "M4A", "TRANSCRIPT"].includes(f.file_type)
  );

  if (files.length === 0) return { synced: 0, error: null };

  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();

  const rows = files.map((f) => ({
    clinic_id:       clinicId,
    appointment_id:  appointmentId,
    patient_id:      patientId,
    zoom_meeting_id: meetingId,
    recording_id:    f.id,
    file_type:       f.file_type,
    file_size:       f.file_size ?? null,
    play_url:        f.play_url ?? null,
    download_url:    f.download_url ?? null,
    recording_start: f.recording_start ?? null,
    recording_end:   f.recording_end ?? null,
    status:          "completed",
  }));

  const { error } = await supabase
    .from("zoom_recordings")
    .upsert(rows, { onConflict: "recording_id" });

  if (error) { console.error("zoom_recordings upsert failed", error); return { synced: 0, error: error.message }; }
  return { synced: rows.length, error: null };
}

/**
 * Process a Zoom `recording.completed` webhook payload.
 * Finds the appointment by zoom_meeting_id and stores all recording files.
 */
export async function processZoomRecordingWebhook(payload: {
  payload: {
    object: {
      id: string | number; // meeting ID
      recording_files?: Array<{
        id: string;
        file_type: string;
        file_size: number;
        play_url?: string;
        download_url?: string;
        recording_start?: string;
        recording_end?: string;
        status: string;
      }>;
    };
  };
}): Promise<{ ok: boolean; synced: number }> {
  const meetingId = String(payload.payload.object.id);
  const files = (payload.payload.object.recording_files ?? []).filter(
    (f) => f.status === "completed" && ["MP4", "M4A", "TRANSCRIPT"].includes(f.file_type)
  );
  if (files.length === 0) return { ok: true, synced: 0 };

  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();

  // Find appointment by zoom_meeting_id
  const { data: appt } = await supabase
    .from("appointments")
    .select("id, clinic_id, patient_id")
    .eq("zoom_meeting_id", meetingId)
    .maybeSingle();

  if (!appt) {
    console.warn("zoom webhook: no appointment found for meeting", meetingId);
    return { ok: true, synced: 0 };
  }

  const rows = files.map((f) => ({
    clinic_id:       appt.clinic_id,
    appointment_id:  appt.id,
    patient_id:      appt.patient_id,
    zoom_meeting_id: meetingId,
    recording_id:    f.id,
    file_type:       f.file_type,
    file_size:       f.file_size ?? null,
    play_url:        f.play_url ?? null,
    download_url:    f.download_url ?? null,
    recording_start: f.recording_start ?? null,
    recording_end:   f.recording_end ?? null,
    status:          "completed",
  }));

  const { error } = await supabase
    .from("zoom_recordings")
    .upsert(rows, { onConflict: "recording_id" });

  if (error) { console.error("zoom_recordings upsert failed", error); return { ok: false, synced: 0 }; }
  return { ok: true, synced: rows.length };
}

/**
 * Get all recordings for a list of appointment IDs (for prontuario timeline).
 */
export async function getZoomRecordingsByAppointments(
  appointmentIds: string[],
): Promise<ZoomRecording[]> {
  if (appointmentIds.length === 0) return [];
  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("zoom_recordings")
    .select("*")
    .in("appointment_id", appointmentIds)
    .order("recording_start", { ascending: true });
  return (data ?? []) as ZoomRecording[];
}

/**
 * Get recordings for a single appointment (for session page).
 */
export async function getZoomRecordingsByAppointment(
  appointmentId: string,
): Promise<ZoomRecording[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("zoom_recordings")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("recording_start", { ascending: true });
  return (data ?? []) as ZoomRecording[];
}
