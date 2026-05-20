import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import type { AppRole } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  created_at: string;
}

export interface TeamInvite {
  id: string;
  clinic_id: string;
  email: string;
  role: AppRole;
  token_hash: string;
  invited_by: string | null;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

// ── Role helpers ──────────────────────────────────────────────────

export const ROLE_LABELS: Record<AppRole, string> = {
  admin:              "Admin",
  platform_admin:     "Admin da plataforma",
  platform_support:   "Suporte",
  clinic_owner:       "Proprietário",
  clinic_manager:     "Gestor",
  practitioner:       "Profissional de saúde",
  front_desk:         "Recepção",
  read_only_staff:    "Visualizador",
  staff:              "Equipe",
};

export const INVITABLE_ROLES: AppRole[] = [
  "clinic_manager",
  "practitioner",
  "front_desk",
  "read_only_staff",
];

export function isManager(role: AppRole): boolean {
  return role === "clinic_owner" || role === "clinic_manager" || role === "admin";
}

export function isPractitioner(role: AppRole): boolean {
  return role === "practitioner";
}

// ── Team members ──────────────────────────────────────────────────

export async function getTeamMembers(clinicId: string): Promise<TeamMember[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at");

  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

export async function updateMemberRole(userId: string, role: AppRole): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw error;
}

export async function removeTeamMember(userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // Detach from clinic rather than delete the account
  const { error } = await supabase
    .from("users")
    .update({ clinic_id: null, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw error;
}

// ── Invites ───────────────────────────────────────────────────────

export async function getPendingInvites(clinicId: string): Promise<TeamInvite[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TeamInvite[];
}

export async function inviteTeamMember(
  clinicId: string,
  clinicName: string,
  email: string,
  role: AppRole,
  invitedById: string,
): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const token = randomUUID();

  // Cancel any existing pending invite for this email+clinic
  await supabase
    .from("invites")
    .update({ status: "rejected" })
    .eq("clinic_id", clinicId)
    .eq("email", email.toLowerCase())
    .eq("status", "pending");

  const { error } = await supabase.from("invites").insert({
    clinic_id:  clinicId,
    email:      email.toLowerCase().trim(),
    role,
    token_hash: token,
    invited_by: invitedById,
    status:     "pending",
  });

  if (error) throw error;

  // Send email
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const joinUrl = `${appUrl}/join/${token}`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? "noreply@axielcore.com",
      to:      email,
      subject: `Convite para ${clinicName} — AXIEL Core`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="font-size:20px;font-weight:700;color:#0F1A2E;margin:0 0 8px">
            Você foi convidado para ${clinicName}
          </h2>
          <p style="font-size:14px;color:#6B6A66;margin:0 0 24px">
            Clique no botão abaixo para aceitar o convite e acessar o AXIEL Core como
            <strong>${ROLE_LABELS[role]}</strong>.
          </p>
          <a href="${joinUrl}"
             style="display:inline-block;background:#0B1F3A;color:white;text-decoration:none;
                    font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px">
            Aceitar convite
          </a>
          <p style="font-size:12px;color:#A09E98;margin:24px 0 0">
            Se não esperava este e-mail, pode ignorá-lo.
            O link expira em 7 dias.
          </p>
        </div>
      `,
    });
  } catch {
    // Email failure is non-fatal — invite is already in the DB
  }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("invites")
    .update({ status: "rejected" })
    .eq("id", inviteId);

  if (error) throw error;
}

// ── Accept invite ─────────────────────────────────────────────────

export async function getInviteByToken(token: string): Promise<TeamInvite | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("invites")
    .select("*")
    .eq("token_hash", token)
    .eq("status", "pending")
    .maybeSingle();

  return (data ?? null) as TeamInvite | null;
}

export async function acceptInvite(token: string, userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const invite = await getInviteByToken(token);
  if (!invite) throw new Error("Convite inválido ou já utilizado.");

  // Link user to clinic with the invited role
  const { error: userError } = await supabase
    .from("users")
    .update({
      clinic_id:  invite.clinic_id,
      role:       invite.role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (userError) throw userError;

  // Mark invite as accepted
  await supabase
    .from("invites")
    .update({ status: "accepted" })
    .eq("id", invite.id);
}
