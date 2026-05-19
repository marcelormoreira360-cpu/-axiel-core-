import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcalDate(iso: string): string {
  return iso.replace(/[-:]/g, "").split(".")[0] + "Z";
}

function foldLine(line: string): string {
  // RFC 5545: fold lines longer than 75 octets
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let pos = 0;
  chunks.push(line.slice(pos, pos + 75));
  pos += 75;
  while (pos < line.length) {
    chunks.push(" " + line.slice(pos, pos + 74));
    pos += 74;
  }
  return chunks.join("\r\n");
}

export async function generateIcalFeed(clinicId: string, clinicName: string): Promise<string> {
  const supabase = createSupabaseAdminClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, starts_at, duration_minutes, notes, ical_uid, zoom_join_url, patients(full_name), session_types(name)")
    .eq("clinic_id", clinicId)
    .order("starts_at", { ascending: false })
    .limit(500);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//AXIEL Core//Clinic Calendar//PT`,
    `X-WR-CALNAME:${escapeIcal(clinicName)}`,
    "X-WR-CALDESC:Consultas agendadas",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const appt of appointments ?? []) {
    const patient = Array.isArray(appt.patients) ? appt.patients[0] : appt.patients;
    const sessionType = Array.isArray(appt.session_types) ? appt.session_types[0] : appt.session_types;

    const startDt = new Date(appt.starts_at);
    const endDt   = new Date(startDt.getTime() + (appt.duration_minutes ?? 60) * 60 * 1000);
    const uid     = appt.ical_uid ?? appt.id;

    const summary     = `${sessionType?.name ?? "Consulta"} — ${patient?.full_name ?? "Paciente"}`;
    const descParts   = [appt.notes, appt.zoom_join_url ? `Zoom: ${appt.zoom_join_url}` : null].filter(Boolean);
    const description = descParts.join("\\n");

    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${uid}@axiel.app`));
    lines.push(`DTSTAMP:${toIcalDate(new Date().toISOString())}`);
    lines.push(`DTSTART:${toIcalDate(startDt.toISOString())}`);
    lines.push(`DTEND:${toIcalDate(endDt.toISOString())}`);
    lines.push(foldLine(`SUMMARY:${escapeIcal(summary)}`));
    if (description) lines.push(foldLine(`DESCRIPTION:${description}`));
    if (appt.zoom_join_url) lines.push(foldLine(`LOCATION:${escapeIcal(appt.zoom_join_url)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export async function getIcalSecret(clinicId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("clinics").select("ical_secret").eq("id", clinicId).maybeSingle();
  return data?.ical_secret ?? null;
}

export async function getClinicByIcalToken(token: string): Promise<{ id: string; name: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("clinics").select("id, name").eq("ical_secret", token).maybeSingle();
  return data ?? null;
}
