import { createLogger } from "@/lib/logger";

const log = createLogger("zoom-service");

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

  if (!res.ok) { log.error("Zoom S2S token failed", { response: await res.text() }); return null; }
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

  if (!res.ok) { log.error("Zoom meeting creation failed", { response: await res.text() }); return null; }
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
    log.error("Zoom recordings fetch failed", { response: msg });
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

  if (error) { log.error("zoom_recordings upsert failed", error); return { synced: 0, error: error.message }; }
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
    log.warn("zoom webhook: no appointment found for meeting", { meetingId });
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

  if (error) { log.error("zoom_recordings upsert failed", error); return { ok: false, synced: 0 }; }
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

// ── Escriba Fase 3: transcrição da gravação do Zoom ──────────────────────────

/** Converte o VTT do Zoom em texto corrido (remove cabeçalho, timestamps e índices). */
function parseVtt(vtt: string): string {
  return vtt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && l !== "WEBVTT" && !l.includes("-->") && !/^\d+$/.test(l))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Transcreve a gravação do Zoom de uma consulta (telesaúde). Prefere o TRANSCRIPT
 * do próprio Zoom (VTT, sem limite de tamanho); cai para o áudio M4A via Whisper
 * (limite 25 MB, pois não há ffmpeg no runtime serverless). Escopo por clinic_id.
 */
export async function transcribeZoomRecording(
  appointmentId: string,
  clinicId: string,
  locale?: string | null,
): Promise<{ transcript: string; source: "zoom_transcript" | "whisper" } | { error: string }> {
  const creds = clinicId ? await getClinicZoomCreds(clinicId) : null;
  const token = await getZoomAccessToken(creds);
  if (!token) return { error: "Zoom não configurado." };

  const { createSupabaseAdminClient } = await import("@/lib/supabase-admin");
  const supabase = createSupabaseAdminClient();
  const { data: recs } = await supabase
    .from("zoom_recordings")
    .select("file_type, download_url, file_size")
    .eq("appointment_id", appointmentId)
    .eq("clinic_id", clinicId)
    .eq("status", "completed");

  const recordings = (recs ?? []) as {
    file_type: string | null;
    download_url: string | null;
    file_size: number | null;
  }[];
  if (recordings.length === 0) return { error: "Nenhuma gravação do Zoom disponível ainda." };

  // 1) Transcript do próprio Zoom (VTT) — caminho preferido, sem limite de tamanho.
  const transcriptFile = recordings.find((r) => r.file_type === "TRANSCRIPT" && r.download_url);
  if (transcriptFile?.download_url) {
    try {
      const res = await fetch(transcriptFile.download_url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const text = parseVtt(await res.text());
        if (text.length > 20) return { transcript: text, source: "zoom_transcript" };
      }
    } catch (err) {
      log.error("zoom transcript fetch failed", err);
    }
  }

  // 2) Fallback: áudio M4A via Whisper (limite 25 MB — sem ffmpeg no serverless).
  const audioFile = recordings.find((r) => r.file_type === "M4A" && r.download_url);
  if (!audioFile?.download_url) {
    return { error: "Gravação sem transcrição utilizável. Ative a transcrição de áudio no Zoom." };
  }
  const MAX = 25 * 1024 * 1024;
  if ((audioFile.file_size ?? 0) > MAX) {
    return { error: "Gravação longa demais. Ative a transcrição de áudio no Zoom para consultas longas." };
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: "IA não configurada (OPENAI_API_KEY ausente)." };
  try {
    const audioRes = await fetch(audioFile.download_url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!audioRes.ok) return { error: "Não foi possível baixar a gravação do Zoom." };
    const buf = Buffer.from(await audioRes.arrayBuffer());
    if (buf.byteLength > MAX) return { error: "Gravação grande demais para transcrever (máx. 25 MB)." };

    const form = new FormData();
    form.append("file", new Blob([buf], { type: "audio/m4a" }), "zoom.m4a");
    form.append("model", "whisper-1");
    const langHint = String(locale ?? "").toLowerCase().slice(0, 2);
    if (["pt", "en", "es"].includes(langHint)) form.append("language", langHint);

    const wRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!wRes.ok) {
      log.error("zoom whisper failed", { response: await wRes.text() });
      return { error: "Falha ao transcrever a gravação." };
    }
    const wData = await wRes.json();
    const text = String(wData.text ?? "").trim();
    if (!text) return { error: "Transcrição vazia." };
    return { transcript: text, source: "whisper" };
  } catch (err) {
    log.error("zoom audio transcription failed", err);
    return { error: "Falha ao transcrever a gravação." };
  }
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
