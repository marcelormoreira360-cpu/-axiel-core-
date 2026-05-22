"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import crypto from "node:crypto";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getLinkByToken(rawToken: string) {
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashToken(rawToken);
  const { data } = await supabase
    .from("patient_portal_links")
    .select("id, clinic_id, patient_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data;
}

// ── Update patient contact info ───────────────────────────────────────────────

export async function updatePatientContactAction(
  rawToken: string,
  updates: { phone?: string; email?: string },
): Promise<{ ok: boolean; error: string | null }> {
  const link = await getLinkByToken(rawToken);
  if (!link) return { ok: false, error: "Link inválido ou expirado." };

  const supabase = createSupabaseAdminClient();
  const cleanUpdates: Record<string, string> = {};
  if (updates.phone?.trim()) cleanUpdates.phone = updates.phone.trim();
  if (updates.email?.trim()) cleanUpdates.email = updates.email.trim().toLowerCase();

  if (Object.keys(cleanUpdates).length === 0) return { ok: true, error: null };

  const { error } = await supabase
    .from("patients")
    .update(cleanUpdates)
    .eq("id", link.patient_id)
    .eq("clinic_id", link.clinic_id);

  if (error) return { ok: false, error: "Erro ao salvar. Tente novamente." };
  return { ok: true, error: null };
}

// ── Upload patient document ───────────────────────────────────────────────────

export async function uploadPortalDocumentAction(
  rawToken: string,
  formData: FormData,
): Promise<{ ok: boolean; error: string | null }> {
  const link = await getLinkByToken(rawToken);
  if (!link) return { ok: false, error: "Link inválido ou expirado." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Nenhum arquivo selecionado." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Arquivo muito grande (máx. 10 MB)." };

  const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Tipo de arquivo não suportado. Use PDF, imagem ou texto." };
  }

  const { uploadPatientDocument } = await import("@/services/patient-document-service");
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await uploadPatientDocument(
      buffer,
      file.name,
      file.type,
      file.size,
      link.patient_id,
      link.clinic_id,
      "portal",
      null,
    );
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Erro ao enviar arquivo. Tente novamente." };
  }
}
