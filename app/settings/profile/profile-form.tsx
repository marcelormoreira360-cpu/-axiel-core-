"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-axiel-line p-6 space-y-4">
      <h2 className="text-base font-semibold text-axiel-ink">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-black/50">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-axiel-line bg-white px-4 py-2.5 text-sm text-axiel-ink outline-none focus:ring-2 focus:ring-axiel-gold/30 transition";

function Feedback({ msg }: { msg: { type: "ok" | "err"; text: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`text-xs ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
      {msg.text}
    </p>
  );
}

export function ProfileForm() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nameMsg, setNameMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [passMsg, setPassMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      setEmail(data.user.email ?? "");
    });
    supabase.from("users").select("full_name").maybeSingle().then(({ data }) => {
      if (data?.full_name) setFullName(data.full_name);
    });
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true); setNameMsg(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("users").update({ full_name: fullName.trim() }).eq("id", user.id);
    setSavingName(false);
    setNameMsg(error ? { type: "err", text: error.message } : { type: "ok", text: "Nome atualizado." });
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    setSavingEmail(true); setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email });
    setSavingEmail(false);
    setEmailMsg(error
      ? { type: "err", text: error.message }
      : { type: "ok", text: "Confirmação enviada para o novo email." });
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setPassMsg({ type: "err", text: "As senhas não coincidem." }); return; }
    if (newPassword.length < 8) { setPassMsg({ type: "err", text: "Mínimo 8 caracteres." }); return; }
    setSavingPass(true); setPassMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPass(false);
    if (error) { setPassMsg({ type: "err", text: error.message }); return; }
    setPassMsg({ type: "ok", text: "Senha atualizada com sucesso." });
    setNewPassword(""); setConfirmPassword("");
  }

  return (
    <div className="max-w-xl space-y-4">
      <Section title="Nome">
        <form onSubmit={saveName} className="space-y-3">
          <Field label="Nome completo">
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome" className={inputClass} />
          </Field>
          <Feedback msg={nameMsg} />
          <div className="flex justify-end">
            <button type="submit" disabled={savingName}
              className="text-xs font-medium text-white bg-axiel-ink hover:bg-black disabled:opacity-40 rounded-xl px-5 py-2 transition">
              {savingName ? "Salvando..." : "Salvar nome"}
            </button>
          </div>
        </form>
      </Section>

      <Section title="Email">
        <form onSubmit={saveEmail} className="space-y-3">
          <Field label="Endereço de email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
          <p className="text-xs text-black/40">Uma confirmação será enviada ao novo endereço.</p>
          <Feedback msg={emailMsg} />
          <div className="flex justify-end">
            <button type="submit" disabled={savingEmail}
              className="text-xs font-medium text-white bg-axiel-ink hover:bg-black disabled:opacity-40 rounded-xl px-5 py-2 transition">
              {savingEmail ? "Salvando..." : "Atualizar email"}
            </button>
          </div>
        </form>
      </Section>

      <Section title="Senha">
        <form onSubmit={savePassword} className="space-y-3">
          <Field label="Nova senha">
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres" className={inputClass} />
          </Field>
          <Field label="Confirmar nova senha">
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha" className={inputClass} />
          </Field>
          <Feedback msg={passMsg} />
          <div className="flex justify-end">
            <button type="submit" disabled={savingPass}
              className="text-xs font-medium text-white bg-axiel-ink hover:bg-black disabled:opacity-40 rounded-xl px-5 py-2 transition">
              {savingPass ? "Salvando..." : "Alterar senha"}
            </button>
          </div>
        </form>
      </Section>
    </div>
  );
}
