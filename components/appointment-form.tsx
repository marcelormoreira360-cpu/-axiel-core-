"use client";

import { useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import type { Patient, SessionType, AppointmentSource } from "@/lib/types";

export interface ClinicUserOption {
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  specialty: string | null;
}

type Props = {
  patients: Patient[];
  sessionTypes: SessionType[];
  action: (formData: FormData) => Promise<void>;
  clinicUsers?: ClinicUserOption[];
};

export function AppointmentForm({ patients, sessionTypes, action, clinicUsers }: Props) {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedType, setSelectedType] = useState<SessionType | null>(sessionTypes[0] ?? null);
  const [source, setSource] = useState<AppointmentSource>("direct");
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const SOURCE_LABELS: Record<AppointmentSource, string> = {
    direct:    "Direto / presencial",
    referral:  "Indicação",
    instagram: "Instagram",
    facebook:  "Facebook",
    google:    "Google",
    website:   "Site",
    package:   "Pacote ativo",
    other:     "Outro",
  };

  const filtered =
    query.trim().length > 0
      ? patients
          .filter(
            (p) =>
              p.full_name.toLowerCase().includes(query.toLowerCase()) ||
              (p.email ?? "").toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 6)
      : [];

  function pickPatient(patient: Patient) {
    setSelectedPatient(patient);
    setQuery(patient.full_name);
  }

  function submit(formData: FormData) {
    if (!selectedPatient || !selectedType) return;
    formData.set("patient_id", selectedPatient.id);
    formData.set("session_type_id", selectedType.id);
    formData.set("duration_minutes", String(selectedType.duration_minutes));
    formData.set("source", source);
    if (selectedPractitionerId) {
      formData.set("practitioner_id", selectedPractitionerId);
    }
    startTransition(async () => {
      await action(formData);
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const canSubmit = !!selectedPatient && !!selectedType && !isPending;

  return (
    <form action={submit} className="space-y-[18px]">
      {/* Patient search */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <label className="text-[11px] font-medium text-[#6B6A66] mb-[8px] block">Paciente</label>
        <div className="relative">
          <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 h-[13px] w-[13px] text-[#A09E98] pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedPatient && e.target.value !== selectedPatient.full_name) {
                setSelectedPatient(null);
              }
            }}
            placeholder="Buscar paciente..."
            autoComplete="off"
            className="w-full pl-[30px] pr-3 py-[9px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
          />
        </div>

        {filtered.length > 0 && !selectedPatient && (
          <div className="mt-[4px] bg-white border border-black/[.08] rounded-[8px] overflow-hidden shadow-sm">
            {filtered.map((patient, i) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => pickPatient(patient)}
                className={[
                  "w-full text-left px-[12px] py-[9px] hover:bg-[#F4F3EF] transition flex items-center gap-[8px]",
                  i !== filtered.length - 1 ? "border-b border-black/[.05]" : "",
                ].join(" ")}
              >
                <div className="w-6 h-6 rounded-full bg-[#E1F5EE] flex items-center justify-center text-[9px] font-medium text-[#0F6E56] shrink-0">
                  {patient.full_name
                    .trim()
                    .split(/\s+/)
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-[#0F1A2E]">{patient.full_name}</p>
                  {patient.email && <p className="text-[10px] text-[#A09E98]">{patient.email}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedPatient && (
          <div className="mt-[6px] flex items-center gap-[8px] px-[10px] py-[7px] bg-[#E1F5EE] rounded-[8px]">
            <span className="text-[12px] text-[#085041] font-medium flex-1">{selectedPatient.full_name}</span>
            <button
              type="button"
              onClick={() => {
                setSelectedPatient(null);
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-[#A09E98] hover:text-[#0F1A2E] transition"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Treatment type */}
      {sessionTypes.length > 0 && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[8px] block">Tipo de tratamento</label>
          <div className="space-y-[5px]">
            {sessionTypes.map((type) => {
              const isSelected = selectedType?.id === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={[
                    "w-full flex items-center justify-between px-[12px] py-[9px] rounded-[8px] border text-left transition",
                    isSelected
                      ? "border-[#0F6E56] bg-[#F0FAF6]"
                      : "border-black/[.08] hover:border-black/[.16] bg-white",
                  ].join(" ")}
                >
                  <span className={`text-[12px] font-medium ${isSelected ? "text-[#0F6E56]" : "text-[#0F1A2E]"}`}>
                    {type.name}
                  </span>
                  <div className="flex items-center gap-[8px]">
                    {type.price_cents > 0 && (
                      <span className={`text-[11px] font-medium ${isSelected ? "text-[#0F6E56]" : "text-[#0F1A2E]"}`}>
                        {(type.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    )}
                    <span className={`text-[11px] ${isSelected ? "text-[#0F6E56]" : "text-[#A09E98]"}`}>
                      {type.duration_minutes} min
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Practitioner */}
      {clinicUsers && clinicUsers.length > 0 && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <label className="text-[11px] font-medium text-[#6B6A66] mb-[8px] block">Profissional responsável</label>
          <select
            value={selectedPractitionerId}
            onChange={(e) => setSelectedPractitionerId(e.target.value)}
            className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition bg-white"
          >
            <option value="">— Nenhum (sem responsável definido) —</option>
            {clinicUsers.map((cu) => {
              const label = cu.display_name ?? cu.full_name ?? cu.user_id;
              return (
                <option key={cu.user_id} value={cu.user_id}>
                  {label}{cu.specialty ? ` — ${cu.specialty}` : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Date and time */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <div className="grid grid-cols-2 gap-[12px]">
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">Data</label>
            <input
              name="date"
              type="date"
              required
              defaultValue={today}
              className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">Horário</label>
            <input
              name="time"
              type="time"
              required
              defaultValue="09:00"
              className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] outline-none focus:border-[#0F6E56] transition"
            />
          </div>
        </div>
      </div>

      {/* Origin */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <label className="text-[11px] font-medium text-[#6B6A66] mb-[8px] block">Origem do agendamento</label>
        <div className="grid grid-cols-2 gap-[5px]">
          {(Object.keys(SOURCE_LABELS) as AppointmentSource[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSource(key)}
              className={[
                "text-left px-[10px] py-[7px] rounded-[7px] border text-[12px] transition",
                source === key
                  ? "border-[#0F6E56] bg-[#F0FAF6] text-[#0F6E56] font-medium"
                  : "border-black/[.08] text-[#6B6A66] hover:border-black/[.16]",
              ].join(" ")}
            >
              {SOURCE_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Teleconsulta */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <label className="text-[11px] font-medium text-[#6B6A66] mb-[2px] block">Link de teleconsulta</label>
        <p className="text-[10px] text-[#A09E98] mb-[8px]">Google Meet, Zoom, Whereby, Teams… (opcional)</p>
        <input
          name="video_url"
          type="url"
          placeholder="https://meet.google.com/xxx-yyyy-zzz"
          className="w-full px-[10px] py-[8px] rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
        />
      </div>

      {/* Notes */}
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
        <label className="text-[11px] font-medium text-[#6B6A66] mb-[6px] block">Observações</label>
        <textarea
          name="notes"
          rows={4}
          placeholder="Nota interna sobre a sessão (opcional)."
          className="w-full resize-none rounded-[8px] border border-black/[.10] px-[10px] py-[8px] text-[13px] text-[#0F1A2E] placeholder:text-[#D3D1C7] outline-none focus:border-[#0F6E56] transition"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] disabled:opacity-40 rounded-[10px] py-[11px] transition"
      >
        {isPending ? "Salvando…" : "Confirmar sessão"}
      </button>
    </form>
  );
}
