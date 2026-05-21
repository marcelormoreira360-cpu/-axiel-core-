"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";

interface SessionType   { id: string; name: string; duration_minutes: number; price_cents: number; }
interface WorkingHour   { day_of_week: number; is_open: boolean; }
interface Slot          { time: string; iso: string; }
interface ClinicInfo    { id: string; name: string; slug: string; logo_url?: string | null; primary_color?: string | null; }
interface Practitioner  { id: string; display_name: string; specialty: string | null; bio: string | null; }

type Step = "profissional" | "service" | "date" | "slot" | "info" | "done";

const STEP_LABELS: Record<Exclude<Step, "done">, string> = {
  profissional: "Profissional",
  service:      "Serviço",
  date:         "Data",
  slot:         "Horário",
  info:         "Seus dados",
};
const ALL_STEPS: Step[] = ["profissional", "service", "date", "slot", "info", "done"];

function fmt(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function addDays(date: Date, n: number) {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();

  const [clinic, setClinic]               = useState<ClinicInfo | null>(null);
  const [sessionTypes, setSessionTypes]   = useState<SessionType[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [openDays, setOpenDays]           = useState<Set<number>>(new Set([1,2,3,4,5]));
  const [step, setStep]                   = useState<Step>("profissional");
  const [activeSteps, setActiveSteps]     = useState<Step[]>(ALL_STEPS);

  const [selectedPractitioner, setSelectedPractitioner] = useState<Practitioner | null>(null);
  const [selectedType, setSelectedType]   = useState<SessionType | null>(null);
  const [selectedDate, setSelectedDate]   = useState<string>("");
  const [slots, setSlots]                 = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots]   = useState(false);
  const [selectedSlot, setSelectedSlot]   = useState<Slot | null>(null);

  const [fullName, setFullName]           = useState("");
  const [email, setEmail]                 = useState("");
  const [phone, setPhone]                 = useState("");
  const [notes, setNotes]                 = useState("");
  const [error, setError]                 = useState("");
  const [isPending, startTransition]      = useTransition();
  const [appointmentDate, setAppointmentDate] = useState("");

  const accent = clinic?.primary_color ?? "#0F6E56";

  // Load clinic info
  useEffect(() => {
    fetch(`/api/book/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setClinic(d.clinic);
        setSessionTypes(d.sessionTypes);
        const ps: Practitioner[] = d.practitioners ?? [];
        setPractitioners(ps);
        const open = new Set<number>(
          (d.workingHours as WorkingHour[]).filter((w) => w.is_open).map((w) => w.day_of_week)
        );
        if (open.size > 0) setOpenDays(open);

        // Determine effective step order
        if (ps.length === 0) {
          setActiveSteps(["service", "date", "slot", "info", "done"]);
          setStep("service");
        } else if (ps.length === 1) {
          setSelectedPractitioner(ps[0]);
          setActiveSteps(["profissional", "service", "date", "slot", "info", "done"]);
          setStep("service");
        } else {
          setActiveSteps(ALL_STEPS);
          setStep("profissional");
        }
      })
      .catch(() => setError("Não foi possível carregar as informações da clínica."));
  }, [slug]);

  // Load slots when date changes
  useEffect(() => {
    if (!selectedDate || !selectedType) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot(null);
    const practId = selectedPractitioner ? `&practitioner_id=${selectedPractitioner.id}` : "";
    fetch(`/api/book/${slug}/slots?date=${selectedDate}&session_type_id=${selectedType.id}${practId}`)
      .then((r) => r.json())
      .then((d) => { setSlots(d.slots ?? []); })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedType, selectedPractitioner, slug]);

  function isDateDisabled(dateStr: string) {
    const dow = new Date(`${dateStr}T12:00:00`).getDay();
    return !openDays.has(dow) || dateStr < toDateStr(new Date());
  }

  function handleSubmit() {
    if (!selectedType || !selectedSlot || !fullName || !phone) return;
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/book/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_type_id: selectedType.id,
          starts_at: selectedSlot.iso,
          full_name: fullName,
          email,
          phone,
          notes,
          practitioner_id: selectedPractitioner?.id ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error ?? "Erro ao agendar. Tente novamente."); return; }
      const d = new Date(selectedSlot.iso);
      setAppointmentDate(
        d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) +
        " às " +
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      );
      setStep("done");
    });
  }

  // Visible steps for indicator (exclude "done")
  const visibleSteps = activeSteps.filter((s) => s !== "done") as Exclude<Step, "done">[];

  // ── Render ──────────────────────────────────────────────────────────────────

  if (error && !clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F5] p-6">
        <p className="text-[13px] text-[#A09E98]">{error}</p>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8F5]">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F8F5] flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          {clinic.logo_url ? (
            <img src={clinic.logo_url} alt={clinic.name} className="mx-auto mb-2 h-10 max-w-[160px] object-contain" />
          ) : (
            <p className="text-[11px] font-medium tracking-[.12em] uppercase text-[#A09E98]">Agendamento online</p>
          )}
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[#0F1A2E]">{clinic.name}</h1>
        </div>

        {/* Step indicator */}
        {step !== "done" && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {visibleSteps.map((s, i) => {
              const cur = visibleSteps.indexOf(step as Exclude<Step, "done">);
              const done = i < cur;
              const active = s === step;
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="h-px w-6" style={{ background: done ? accent : "rgba(0,0,0,0.1)" }} />}
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full text-[10px] font-semibold flex items-center justify-center transition-all"
                      style={
                        active
                          ? { background: accent, color: "white" }
                          : done
                          ? { background: `${accent}22`, color: accent }
                          : { background: "white", border: "1px solid rgba(0,0,0,0.1)", color: "#A09E98" }
                      }
                    >
                      {done ? "✓" : i + 1}
                    </div>
                    <span className={`text-[11px] hidden sm:block ${active ? "text-[#0F1A2E] font-medium" : "text-[#A09E98]"}`}>
                      {STEP_LABELS[s]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Step: profissional ── */}
        {step === "profissional" && (
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-[#0F1A2E] mb-4">Escolha o profissional</p>
            {practitioners.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedPractitioner(p); setStep("service"); }}
                className="w-full bg-white border border-black/[.07] rounded-[12px] px-5 py-4 text-left hover:border-[#0F6E56] hover:bg-[#F0FAF6] transition group"
                style={{ ["--accent" as string]: accent }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[15px] font-semibold shrink-0 text-white"
                    style={{ background: accent }}
                  >
                    {p.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#0F1A2E] group-hover:text-[#0F6E56] transition truncate">{p.display_name}</p>
                    {p.specialty && <p className="text-[12px] text-[#A09E98] truncate">{p.specialty}</p>}
                    {p.bio && <p className="text-[11px] text-[#6B6A66] mt-1 line-clamp-2">{p.bio}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Step: service ── */}
        {step === "service" && (
          <div className="space-y-3">
            {activeSteps.includes("profissional") && (
              <button onClick={() => setStep("profissional")} className="text-[12px] text-[#A09E98] hover:text-[#0F1A2E] mb-4 flex items-center gap-1">
                ← Voltar
              </button>
            )}
            <p className="text-[13px] font-medium text-[#0F1A2E] mb-4">Escolha o serviço</p>
            {sessionTypes.length === 0 && (
              <p className="text-[12px] text-[#A09E98]">Nenhum serviço disponível no momento.</p>
            )}
            {sessionTypes.map((st) => (
              <button
                key={st.id}
                onClick={() => { setSelectedType(st); setStep("date"); }}
                className="w-full bg-white border border-black/[.07] rounded-[12px] px-5 py-4 text-left transition group"
                style={{ borderColor: undefined }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = accent; (e.currentTarget as HTMLButtonElement).style.background = `${accent}11`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = ""; (e.currentTarget as HTMLButtonElement).style.background = ""; }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-medium text-[#0F1A2E] transition">{st.name}</p>
                  {st.price_cents > 0 && (
                    <p className="text-[13px] font-semibold" style={{ color: accent }}>{fmt(st.price_cents)}</p>
                  )}
                </div>
                <p className="text-[12px] text-[#A09E98] mt-[2px]">{st.duration_minutes} minutos</p>
              </button>
            ))}
          </div>
        )}

        {/* ── Step: date ── */}
        {step === "date" && selectedType && (
          <div>
            <button onClick={() => setStep("service")} className="text-[12px] text-[#A09E98] hover:text-[#0F1A2E] mb-4 flex items-center gap-1">
              ← Voltar
            </button>
            <p className="text-[13px] font-medium text-[#0F1A2E] mb-4">Escolha a data</p>
            <div className="bg-white border border-black/[.07] rounded-[12px] p-5">
              <input
                type="date"
                min={toDateStr(addDays(new Date(), 1))}
                value={selectedDate}
                onChange={(e) => {
                  if (!isDateDisabled(e.target.value)) {
                    setSelectedDate(e.target.value);
                  }
                }}
                className="w-full px-4 py-3 rounded-[8px] border border-black/[.10] text-[14px] text-[#0F1A2E] outline-none transition"
                style={{ outlineColor: accent }}
                onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
              />
              {selectedDate && isDateDisabled(selectedDate) && (
                <p className="text-[12px] text-red-500 mt-2">A clínica não atende neste dia.</p>
              )}
            </div>
            <button
              onClick={() => setStep("slot")}
              disabled={!selectedDate || isDateDisabled(selectedDate)}
              className="mt-4 w-full disabled:opacity-40 text-white text-[13px] font-medium rounded-[10px] py-3 transition"
              style={{ background: accent }}
            >
              Ver horários disponíveis
            </button>
          </div>
        )}

        {/* ── Step: slot ── */}
        {step === "slot" && selectedType && selectedDate && (
          <div>
            <button onClick={() => setStep("date")} className="text-[12px] text-[#A09E98] hover:text-[#0F1A2E] mb-4 flex items-center gap-1">
              ← Voltar
            </button>
            <p className="text-[13px] font-medium text-[#0F1A2E] mb-1">Escolha o horário</p>
            <p className="text-[12px] text-[#A09E98] mb-4">
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            {loadingSlots ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
              </div>
            ) : slots.length === 0 ? (
              <div className="bg-white border border-black/[.07] rounded-[12px] p-5 text-center">
                <p className="text-[13px] text-[#A09E98]">Sem horários disponíveis neste dia.</p>
                <button onClick={() => setStep("date")} className="mt-3 text-[12px] hover:underline" style={{ color: accent }}>
                  Escolher outra data
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s) => (
                  <button
                    key={s.iso}
                    onClick={() => setSelectedSlot(s)}
                    className="py-3 rounded-[9px] border text-[13px] font-medium transition"
                    style={
                      selectedSlot?.iso === s.iso
                        ? { borderColor: accent, background: accent, color: "white" }
                        : { borderColor: "rgba(0,0,0,0.08)", background: "white", color: "#0F1A2E" }
                    }
                    onMouseEnter={(e) => {
                      if (selectedSlot?.iso !== s.iso) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = accent;
                        (e.currentTarget as HTMLButtonElement).style.color = accent;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedSlot?.iso !== s.iso) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,0,0,0.08)";
                        (e.currentTarget as HTMLButtonElement).style.color = "#0F1A2E";
                      }
                    }}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
            {selectedSlot && (
              <button
                onClick={() => setStep("info")}
                className="mt-5 w-full text-white text-[13px] font-medium rounded-[10px] py-3 transition"
                style={{ background: accent }}
              >
                Continuar com {selectedSlot.time}
              </button>
            )}
          </div>
        )}

        {/* ── Step: info ── */}
        {step === "info" && selectedType && selectedSlot && (
          <div>
            <button onClick={() => setStep("slot")} className="text-[12px] text-[#A09E98] hover:text-[#0F1A2E] mb-4 flex items-center gap-1">
              ← Voltar
            </button>

            {/* Summary bar */}
            <div className="rounded-[10px] px-4 py-3 mb-5 flex items-center justify-between" style={{ background: `${accent}22` }}>
              <div>
                <p className="text-[12px] font-medium" style={{ color: accent }}>{selectedType.name}</p>
                {selectedPractitioner && (
                  <p className="text-[11px]" style={{ color: accent, opacity: 0.8 }}>{selectedPractitioner.display_name}</p>
                )}
                <p className="text-[11px]" style={{ color: accent, opacity: 0.7 }}>
                  {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} · {selectedSlot.time}
                </p>
              </div>
              {selectedType.price_cents > 0 && (
                <p className="text-[14px] font-semibold" style={{ color: accent }}>{fmt(selectedType.price_cents)}</p>
              )}
            </div>

            <p className="text-[13px] font-medium text-[#0F1A2E] mb-4">Seus dados</p>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-[#6B6A66] mb-1 block">Nome completo *</label>
                <input
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-3 py-2.5 rounded-[8px] border border-black/[.10] text-[13px] outline-none transition"
                  onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#6B6A66] mb-1 block">WhatsApp *</label>
                <input
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                  type="tel"
                  className="w-full px-3 py-2.5 rounded-[8px] border border-black/[.10] text-[13px] outline-none transition"
                  onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#6B6A66] mb-1 block">E-mail</label>
                <input
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  type="email"
                  className="w-full px-3 py-2.5 rounded-[8px] border border-black/[.10] text-[13px] outline-none transition"
                  onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#6B6A66] mb-1 block">Observação (opcional)</label>
                <textarea
                  value={notes} onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Informe sintomas, preferências ou qualquer informação relevante."
                  className="w-full px-3 py-2.5 rounded-[8px] border border-black/[.10] text-[13px] outline-none transition resize-none"
                  onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = ""; }}
                />
              </div>
            </div>

            {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={!fullName || !phone || isPending}
              className="mt-5 w-full disabled:opacity-40 text-white text-[13px] font-medium rounded-[10px] py-3 transition"
              style={{ background: accent }}
            >
              {isPending ? "Confirmando…" : "Confirmar agendamento"}
            </button>

            <p className="mt-3 text-[11px] text-[#A09E98] text-center">
              Você receberá uma confirmação por WhatsApp.
            </p>
          </div>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: `${accent}22` }}>
              <svg className="w-8 h-8" style={{ color: accent }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-[20px] font-semibold text-[#0F1A2E] mb-2">Agendamento confirmado!</h2>
            <p className="text-[13px] text-[#6B6A66] mb-1">{selectedType?.name}</p>
            {selectedPractitioner && (
              <p className="text-[12px] text-[#A09E98] mb-1">com {selectedPractitioner.display_name}</p>
            )}
            <p className="text-[13px] font-medium text-[#0F1A2E] mb-6 capitalize">{appointmentDate}</p>
            <p className="text-[12px] text-[#A09E98]">
              Uma confirmação foi enviada para o seu WhatsApp.<br />
              Até lá!
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
