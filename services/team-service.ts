import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import type { AppRole } from "@/lib/types";
import { getServerT, resolveClinicLocale } from "@/lib/email-i18n";
import { getBillingContext } from "@/services/billing-service";
import { checkUsageLimit } from "@/modules/billing/feature-access";
import { DEFAULT_FROM_EMAIL, APP_URL } from "@/lib/constants";

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
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
}

// ── Role helpers ──────────────────────────────────────────────────
// Re-exported from lib/team-utils so client components can import from there
// without pulling in any server-side dependencies.

export { ROLE_LABELS, INVITABLE_ROLES, isManager, isPractitioner } from "@/lib/team-utils";

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

export async function updateMemberRole(userId: string, role: AppRole, callerClinicId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // B-03: scope update to callerClinicId to prevent IDOR across clinics
  const { error } = await supabase
    .from("users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("clinic_id", callerClinicId); // ← only affect users in same clinic

  if (error) throw error;
}

export async function removeTeamMember(userId: string, callerClinicId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  // B-03: scope detach to callerClinicId to prevent IDOR across clinics
  const { error } = await supabase
    .from("users")
    .update({ clinic_id: null, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .eq("clinic_id", callerClinicId); // ← only detach if the user belongs to this clinic

  if (error) throw error;
}

// ── Invites ───────────────────────────────────────────────────────

export async function getPendingInvites(clinicId: string): Promise<TeamInvite[]> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invites")
    .select("id, clinic_id, email, role, status, token_hash, invited_by, created_at, expires_at")
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

  // ── Usage gate: users (team members) limit ────────────────────────────────
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);
  const billingCtx = await getBillingContext(clinicId, { users: count ?? 0 });
  const usersCheck = checkUsageLimit(billingCtx, "users");
  if (usersCheck.isAtLimit) {
    throw new Error(`Limite de ${usersCheck.limit} usuários atingido no plano atual. Faça upgrade para convidar mais membros.`);
  }

  const token = randomUUID();

  // Cancel any existing pending invite for this email+clinic
  const { error: cancelError } = await supabase
    .from("invites")
    .update({ status: "revoked" })
    .eq("clinic_id", clinicId)
    .eq("email", email.toLowerCase())
    .eq("status", "pending");
  if (cancelError) throw cancelError;

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
  const joinUrl = `${APP_URL}/join/${token}`;
  const locale = await resolveClinicLocale(clinicId);
  const t = await getServerT(locale, "emails");
  const tRoles = await getServerT(locale, "common");
  const roleLabel = tRoles(`roles.${role}`);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from:    DEFAULT_FROM_EMAIL,
      to:      email,
      subject: t("invite.subject", { clinic: clinicName }),
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="font-size:20px;font-weight:700;color:#0F1A2E;margin:0 0 8px">
            ${t("invite.heading", { clinic: clinicName })}
          </h2>
          <p style="font-size:14px;color:#6B6A66;margin:0 0 24px">
            ${t.markup("invite.body", { role: roleLabel, b: (c) => `<strong>${c}</strong>` })}
          </p>
          <a href="${joinUrl}"
             style="display:inline-block;background:#0B1F3A;color:white;text-decoration:none;
                    font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px">
            ${t("invite.cta")}
          </a>
          <p style="font-size:12px;color:#A09E98;margin:24px 0 0">
            ${t("invite.footer")}
          </p>
        </div>
      `,
    });
  } catch (e) {
    // Email failure is non-fatal (invite is already in the DB), mas nao pode
    // ser silencioso: sem log, um remetente sandbox/dominio nao verificado ou
    // key invalida faz o convidado nunca receber o e-mail sem nenhum sinal.
    console.error("[invite] envio do e-mail de convite falhou", {
      clinicId,
      email,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { createSupabaseServerClient } = await import("@/lib/supabase-server");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("invites")
    .update({ status: "revoked" })
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
    .gt("expires_at", new Date().toISOString()) // B-04: reject expired invites
    .maybeSingle();

  return (data ?? null) as TeamInvite | null;
}

export async function acceptInvite(token: string, userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const invite = await getInviteByToken(token);
  if (!invite) throw new Error("Convite inválido ou já utilizado.");

  // O userId vem do cliente (a sessão pode ainda não ter propagado na aba nova),
  // então o vínculo é validado contra o e-mail convidado: só a conta com o
  // MESMO e-mail do convite pode aceitá-lo.
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !authUser?.user?.email) {
    throw new Error("Usuário inválido.");
  }
  if (authUser.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error("Este convite foi emitido para outro e-mail.");
  }

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
