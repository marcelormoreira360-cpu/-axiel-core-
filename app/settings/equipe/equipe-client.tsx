"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, X } from "lucide-react";
import {
  ROLE_LABELS,
  INVITABLE_ROLES,
  isManager,
  type TeamMember,
  type TeamInvite,
} from "@/services/team-service";
import {
  inviteMemberAction,
  updateRoleAction,
  removeMemberAction,
  revokeInviteAction,
} from "./actions";
import type { AppRole } from "@/lib/types";

interface Props {
  members: TeamMember[];
  invites: TeamInvite[];
  currentUserId: string;
  currentUserRole: AppRole;
}

function RoleTag({ role }: { role: AppRole }) {
  const colors: Partial<Record<AppRole, string>> = {
    clinic_owner:    "bg-[#0B1F3A] text-white",
    clinic_manager:  "bg-[#E6F1FB] text-[#0C447C]",
    practitioner:    "bg-[#E1F5EE] text-[#085041]",
    front_desk:      "bg-[#FAEEDA] text-[#633806]",
    read_only_staff: "bg-[#F4F3EF] text-[#6B6A66]",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[role] ?? "bg-[#F4F3EF] text-[#6B6A66]"}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function EquipeClient({ members, invites, currentUserId, currentUserRole }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const canManage = isManager(currentUserRole);

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(null), 3500); }
  function err(msg: string)   { setError(msg);   setTimeout(() => setError(null),   4000); }

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await inviteMemberAction(fd);
      if (r.error) { err(r.error); return; }
      flash("Convite enviado!");
      setShowInvite(false);
      router.refresh();
    });
  }

  function handleRoleChange(userId: string, role: AppRole) {
    startTransition(async () => {
      const r = await updateRoleAction(userId, role);
      if (r.error) { err(r.error); return; }
      flash("Cargo atualizado.");
      router.refresh();
    });
  }

  function handleRemove(userId: string, name: string | null) {
    if (!confirm(`Remover ${name ?? "este membro"} da clínica?`)) return;
    startTransition(async () => {
      const r = await removeMemberAction(userId);
      if (r.error) { err(r.error); return; }
      flash("Membro removido.");
      router.refresh();
    });
  }

  function handleRevoke(inviteId: string) {
    startTransition(async () => {
      const r = await revokeInviteAction(inviteId);
      if (r.error) { err(r.error); return; }
      flash("Convite revogado.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {(error || success) && (
        <div className={`rounded-lg px-4 py-2.5 text-[12px] ${error ? "bg-red-50 text-red-600" : "bg-[#E1F5EE] text-[#0F6E56]"}`}>
          {error ?? success}
        </div>
      )}

      {/* Members */}
      <div className="rounded-2xl border border-black/[.07] bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[.05]">
          <div>
            <p className="text-[13px] font-semibold text-[#0F1A2E]">Membros da equipe</p>
            <p className="text-[11px] text-[#A09E98] mt-0.5">{members.length} membro{members.length !== 1 ? "s" : ""}</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-black transition"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Convidar
            </button>
          )}
        </div>

        <div className="divide-y divide-black/[.04]">
          {members.map((m) => {
            const isSelf = m.id === currentUserId;
            return (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E1F5EE] text-[12px] font-semibold text-[#0F6E56]">
                  {initials(m.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#0F1A2E] truncate">
                    {m.full_name ?? m.email ?? "—"}
                    {isSelf && <span className="ml-2 text-[10px] text-[#A09E98]">(você)</span>}
                  </p>
                  <p className="text-[11px] text-[#A09E98] truncate">{m.email ?? ""}</p>
                </div>

                {canManage && !isSelf ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as AppRole)}
                    disabled={isPending}
                    className="rounded-lg border border-black/15 px-2 py-1 text-[11px] focus:outline-none disabled:opacity-50"
                  >
                    {(["clinic_owner", ...INVITABLE_ROLES] as AppRole[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ) : (
                  <RoleTag role={m.role} />
                )}

                {canManage && !isSelf && (
                  <button
                    onClick={() => handleRemove(m.id, m.full_name)}
                    disabled={isPending}
                    className="text-[#A09E98] hover:text-red-500 transition disabled:opacity-50"
                    title="Remover da clínica"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="rounded-2xl border border-black/[.07] bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[.05]">
            <p className="text-[13px] font-semibold text-[#0F1A2E]">Convites pendentes</p>
          </div>
          <div className="divide-y divide-black/[.04]">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4F3EF]">
                  <Mail className="h-4 w-4 text-[#A09E98]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{inv.email}</p>
                  <p className="text-[11px] text-[#A09E98]">
                    {ROLE_LABELS[inv.role]} · aguardando aceite
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                  Pendente
                </span>
                {canManage && (
                  <button
                    onClick={() => handleRevoke(inv.id)}
                    disabled={isPending}
                    className="text-[#A09E98] hover:text-red-500 transition disabled:opacity-50"
                    title="Revogar convite"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/[.07]">
              <p className="text-[14px] font-semibold text-[#0F1A2E]">Convidar membro</p>
              <button onClick={() => setShowInvite(false)} className="text-[#A09E98] hover:text-[#0F1A2E]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
                  E-mail <span className="text-red-400">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="profissional@clinica.com"
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#6B6A66] mb-1.5">
                  Cargo <span className="text-red-400">*</span>
                </label>
                <select
                  name="role"
                  required
                  defaultValue="practitioner"
                  className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm focus:outline-none"
                >
                  {INVITABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="bg-[#FAFAF8] rounded-lg p-3 text-[11px] text-[#A09E98] space-y-1">
                <p><strong className="text-[#0F1A2E]">Profissional de saúde</strong> — vê apenas sua própria agenda e pacientes atendidos</p>
                <p><strong className="text-[#0F1A2E]">Gestor</strong> — acesso completo a todos os dados</p>
                <p><strong className="text-[#0F1A2E]">Recepção</strong> — agenda e pacientes, sem dados financeiros</p>
                <p><strong className="text-[#0F1A2E]">Visualizador</strong> — somente leitura</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowInvite(false)}
                  className="flex-1 rounded-lg border border-black/15 py-2 text-[12px] font-medium text-[#6B6A66] hover:bg-[#F4F3EF] transition">
                  Cancelar
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 rounded-lg bg-[#0B1F3A] py-2 text-[12px] font-medium text-white hover:bg-black transition disabled:opacity-50">
                  {isPending ? "Enviando..." : "Enviar convite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
