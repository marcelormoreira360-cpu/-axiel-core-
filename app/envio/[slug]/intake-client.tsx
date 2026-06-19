"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { submitIntakeAction, lookupPatientAction } from "./actions";

interface Props {
  clinicId: string;
  clinicName: string;
  logoUrl: string | null;
  primaryColor: string;
}

type UploadedFile = {
  file: File;
  preview: string | null; // data URL for images
};

// "idle" → user typing email
// "looking" → lookup in progress
// "found"   → existing patient recognised
// "new"     → not found, asking for name+phone
type LookupState = "idle" | "looking" | "found" | "new";

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) {
    return (
      <svg className="h-5 w-5 text-[#0C447C]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    );
  }
  if (type === "application/pdf") {
    return (
      <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function IntakeClient({ clinicId, clinicName, logoUrl, primaryColor }: Props) {
  const [step, setStep]               = useState<1 | 2 | 3>(1);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [isPending, startTransition]  = useTransition();
  const [error, setError]             = useState<string | null>(null);
  const [files, setFiles]             = useState<UploadedFile[]>([]);

  // Patient fields
  const [email, setEmail]             = useState("");
  const [name, setName]               = useState("");   // filled by user (new) or returned by lookup (found)
  const [phone, setPhone]             = useState("");
  const [dob, setDob]                 = useState("");   // data de nascimento (yyyy-mm-dd)
  const [sex, setSex]                 = useState("");   // "female" | "male" | "other"
  const [weightKg, setWeightKg]       = useState("");
  const [heightCm, setHeightCm]       = useState("");
  const [patientId, setPatientId]     = useState<string | null>(null); // set when patient recognised

  const [notes, setNotes]             = useState("");
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const formRef                       = useRef<HTMLFormElement>(null);

  const brand = primaryColor ?? "#0B1F3A";

  // ── File helpers ──────────────────────────────────────────────────
  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    Array.from(newFiles).forEach((f) => {
      const preview = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
      setFiles((prev) => [...prev, { file: f, preview }]);
    });
  }

  function removeFile(idx: number) {
    setFiles((prev) => {
      const copy = [...prev];
      if (copy[idx].preview) URL.revokeObjectURL(copy[idx].preview!);
      copy.splice(idx, 1);
      return copy;
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  // ── Step 1: lookup by email ────────────────────────────────────────
  function handleLookup() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setError("Digite seu e-mail para continuar."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) { setError("E-mail inválido."); return; }

    setError(null);
    setLookupState("looking");

    startTransition(async () => {
      const result = await lookupPatientAction(trimmedEmail, clinicId);
      if (result.found && result.patientId) {
        setName(result.name ?? "");
        setPatientId(result.patientId);
        setLookupState("found");
      } else {
        setLookupState("new");
      }
    });
  }

  function handleNewPatientContinue() {
    if (!name.trim()) { setError("Preencha seu nome completo."); return; }
    setError(null);
    setStep(2);
  }

  // ── Step 2: submit ─────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("clinic_id", clinicId);
    fd.set("notes", notes);
    files.forEach(({ file }) => fd.append("files", file));

    if (patientId) {
      // Returning patient — pass the resolved id
      fd.set("patient_id", patientId);
    } else {
      // New patient — pass name/email/phone + demografia for server-side create
      fd.set("name", name);
      fd.set("email", email);
      fd.set("phone", phone);
      if (dob) fd.set("date_of_birth", dob);
      if (sex) fd.set("sex", sex);
      if (weightKg) fd.set("weight_kg", weightKg);
      if (heightCm) fd.set("height_cm", heightCm);
    }

    startTransition(async () => {
      const result = await submitIntakeAction(fd);
      if (result.error) { setError(result.error); return; }
      setStep(3);
    });
  }

  // ── Clinic logo / header (reused in step 1 & 2) ───────────────────
  const ClinicHeader = () => (
    <div className="flex flex-col items-center mb-8">
      {logoUrl ? (
        <Image src={logoUrl} alt={clinicName} width={160} height={56} className="h-14 w-auto object-contain mb-3" />
      ) : (
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: brand }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#A09E98]">
        {clinicName}
      </p>
      <h1 className="text-[22px] font-semibold text-[#0F1A2E] mt-1 text-center">
        Envio de documentos
      </h1>
      <p className="text-[13px] text-[#6B6A66] mt-1 text-center leading-relaxed">
        Envie exames, fotos e observações diretamente para a sua ficha.
      </p>
    </div>
  );

  // ── Step 1: Identification ─────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen bg-[#F7F6F2] flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-md">
          <ClinicHeader />

          {/* Progress */}
          <div className="flex items-center gap-2 mb-7">
            <div className="h-1.5 flex-1 rounded-full" style={{ background: brand }} />
            <div className="h-1.5 flex-1 rounded-full bg-black/10" />
          </div>
          <p className="text-[11px] font-medium text-[#A09E98] mb-5">Passo 1 de 2 — Identificação</p>

          <div className="bg-white rounded-2xl border border-black/[.07] p-6 space-y-4">

            {/* ── Returning patient recognised ── */}
            {lookupState === "found" && (
              <>
                <div className="flex items-center gap-3 rounded-xl bg-[#F0FAF6] border border-[#0F6E56]/20 px-4 py-3">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold text-white"
                    style={{ background: brand }}
                  >
                    {name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0F1A2E]">Olá, {name.split(" ")[0]}!</p>
                    <p className="text-[11px] text-[#0F6E56]">Você já está cadastrado ✓</p>
                  </div>
                </div>
                <p className="text-[12px] text-[#6B6A66]">
                  Identificamos seu cadastro pelo e-mail <span className="font-medium text-[#0F1A2E]">{email}</span>.
                  Clique em continuar para enviar seus arquivos.
                </p>
                <button
                  onClick={() => { setError(null); setStep(2); }}
                  className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white transition active:scale-[.98]"
                  style={{ background: brand }}
                >
                  Continuar →
                </button>
                <button
                  type="button"
                  onClick={() => { setLookupState("idle"); setEmail(""); setName(""); setPatientId(null); }}
                  className="w-full text-[12px] text-[#A09E98] hover:text-[#0F1A2E] transition text-center"
                >
                  Não é você? Usar outro e-mail
                </button>
              </>
            )}

            {/* ── New patient: full form ── */}
            {lookupState === "new" && (
              <>
                <p className="text-[12px] text-[#6B6A66]">
                  E-mail não encontrado. Complete seu cadastro para continuar.
                </p>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#6B6A66] mb-1.5">
                    E-mail
                  </label>
                  <div className="w-full rounded-xl border border-black/10 bg-[#F4F3EF] px-4 py-3 text-[15px] text-[#6B6A66]">
                    {email}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#6B6A66] mb-1.5">
                    Nome completo <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                    autoFocus
                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-[15px] focus:outline-none focus:border-black/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#6B6A66] mb-1.5">
                    Telefone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    autoComplete="tel"
                    inputMode="tel"
                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-[15px] focus:outline-none focus:border-black/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#6B6A66] mb-1.5">
                    Data de nascimento
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-[15px] focus:outline-none focus:border-black/30"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#6B6A66] mb-1.5">
                    Sexo
                  </label>
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-[15px] bg-white focus:outline-none focus:border-black/30"
                  >
                    <option value="">Prefiro não informar</option>
                    <option value="female">Feminino</option>
                    <option value="male">Masculino</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#6B6A66] mb-1.5">
                      Peso (kg)
                    </label>
                    <input
                      type="number" min={0} max={400} step="0.1" inputMode="decimal"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="70"
                      className="w-full rounded-xl border border-black/15 px-4 py-3 text-[15px] focus:outline-none focus:border-black/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#6B6A66] mb-1.5">
                      Altura (cm)
                    </label>
                    <input
                      type="number" min={0} max={260} step="1" inputMode="numeric"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="170"
                      className="w-full rounded-xl border border-black/15 px-4 py-3 text-[15px] focus:outline-none focus:border-black/30"
                    />
                  </div>
                </div>
                <button
                  onClick={handleNewPatientContinue}
                  className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white transition active:scale-[.98]"
                  style={{ background: brand }}
                >
                  Continuar →
                </button>
                <button
                  type="button"
                  onClick={() => { setLookupState("idle"); setName(""); setPhone(""); }}
                  className="w-full text-[12px] text-[#A09E98] hover:text-[#0F1A2E] transition text-center"
                >
                  ← Usar outro e-mail
                </button>
              </>
            )}

            {/* ── Initial email entry ── */}
            {(lookupState === "idle" || lookupState === "looking") && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#6B6A66] mb-1.5">
                    E-mail <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    inputMode="email"
                    autoFocus
                    className="w-full rounded-xl border border-black/15 px-4 py-3 text-[15px] focus:outline-none focus:border-black/30"
                  />
                </div>
                <button
                  onClick={handleLookup}
                  disabled={isPending}
                  className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white transition active:scale-[.98] disabled:opacity-60"
                  style={{ background: brand }}
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Verificando…
                    </span>
                  ) : "Continuar →"}
                </button>
              </>
            )}

            {error && (
              <p className="text-[12px] text-red-500 text-center">{error}</p>
            )}
          </div>

          <p className="text-[11px] text-[#D3D1C7] text-center mt-5 leading-relaxed">
            Suas informações são enviadas com segurança e ficam restritas à equipe da clínica.
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Upload ─────────────────────────────────────────────────
  if (step === 2) {
    const displayName = name || email;
    return (
      <div className="min-h-screen bg-[#F7F6F2] flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setStep(1)}
              className="text-[#A09E98] hover:text-[#0F1A2E] transition"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <div>
              <p className="text-[13px] font-semibold text-[#0F1A2E]">{displayName}</p>
              <p className="text-[11px] text-[#A09E98]">{email}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1.5 flex-1 rounded-full" style={{ background: brand }} />
            <div className="h-1.5 flex-1 rounded-full" style={{ background: brand }} />
          </div>
          <p className="text-[11px] font-medium text-[#A09E98] mb-5">Passo 2 de 2 — Arquivos e observações</p>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-2xl border-2 border-dashed border-black/15 bg-white p-7 flex flex-col items-center gap-3 cursor-pointer hover:border-black/30 transition active:scale-[.99]"
            >
              <div className="h-12 w-12 rounded-full bg-[#F4F3EF] flex items-center justify-center">
                <svg className="h-6 w-6 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[14px] font-medium text-[#0F1A2E]">
                  Toque para selecionar arquivos
                </p>
                <p className="text-[12px] text-[#A09E98] mt-0.5">
                  Fotos, PDFs · até 15 MB por arquivo
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.txt,.doc,.docx"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />

            {/* File list */}
            {files.length > 0 && (
              <div className="bg-white rounded-2xl border border-black/[.07] overflow-hidden">
                {files.map((uf, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 ${i < files.length - 1 ? "border-b border-black/[.05]" : ""}`}
                  >
                    {uf.preview ? (
                      <img
                        src={uf.preview}
                        alt={uf.file.name}
                        className="h-10 w-10 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-[#F4F3EF] flex items-center justify-center shrink-0">
                        <FileIcon type={uf.file.type} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{uf.file.name}</p>
                      <p className="text-[11px] text-[#A09E98]">{fmtSize(uf.file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-[#A09E98] hover:text-red-500 transition"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-black/[.07] p-4">
              <label className="block text-[11px] font-semibold uppercase tracking-[.08em] text-[#6B6A66] mb-2">
                Observações (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Descreva seus sintomas, histórico recente, dúvidas ou qualquer informação que queira passar à sua clínica..."
                rows={4}
                className="w-full text-[14px] text-[#0F1A2E] placeholder:text-[#C4C2BB] focus:outline-none resize-none leading-relaxed"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending || (files.length === 0 && !notes.trim())}
              className="w-full rounded-xl py-3.5 text-[15px] font-semibold text-white transition active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: brand }}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Enviando…
                </span>
              ) : (
                `Enviar ${files.length > 0 ? `${files.length} arquivo${files.length > 1 ? "s" : ""}` : "observação"}`
              )}
            </button>
          </form>

          <p className="text-[11px] text-[#D3D1C7] text-center mt-5">
            Seus arquivos chegam diretamente na ficha da clínica, seguros e criptografados.
          </p>
        </div>
      </div>
    );
  }

  // ── Step 3: Success ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: `${brand}15` }}
        >
          <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" style={{ stroke: brand }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>

        <h1 className="text-[24px] font-semibold text-[#0F1A2E] mb-2">
          Enviado com sucesso!
        </h1>
        <p className="text-[14px] text-[#6B6A66] leading-relaxed mb-2">
          Suas informações chegaram na {clinicName}.
        </p>
        <p className="text-[13px] text-[#A09E98] leading-relaxed">
          A equipe da clínica já pode visualizar seus documentos e observações na sua ficha.
        </p>

        <div className="mt-8 bg-white rounded-2xl border border-black/[.07] p-5 text-left space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[#A09E98]">Resumo do envio</p>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#6B6A66]">Paciente</span>
            <span className="text-[13px] font-medium text-[#0F1A2E]">{name || email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#6B6A66]">Arquivos</span>
            <span className="text-[13px] font-medium text-[#0F1A2E]">
              {files.length > 0 ? `${files.length} arquivo${files.length > 1 ? "s" : ""}` : "Apenas observação"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#6B6A66]">Clínica</span>
            <span className="text-[13px] font-medium text-[#0F1A2E]">{clinicName}</span>
          </div>
        </div>

        <button
          onClick={() => {
            setStep(1);
            setLookupState("idle");
            setFiles([]);
            setName("");
            setEmail("");
            setPhone("");
            setNotes("");
            setPatientId(null);
          }}
          className="mt-6 text-[13px] font-medium text-[#A09E98] hover:text-[#0F1A2E] transition"
        >
          Enviar mais arquivos
        </button>
      </div>
    </div>
  );
}
