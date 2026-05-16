"use client";

import { useState } from "react";
import {
  Sparkles, AlertTriangle, CheckCircle2, Clock, Copy,
  Check, ChevronDown, ChevronUp, Loader2, RefreshCw,
  User, Stethoscope, Pill, FlaskConical, Target, Eye, Mail,
  MessageCircle, Mic
} from "lucide-react";

type Severity = "alta" | "media" | "baixa";

type PriorityFinding = { finding: string; severity: Severity; detail: string };
type ExamAnalysis = { biomarker: string; status: string; clinical_significance: string; trend: string };
type InteractionAlert = { item_a: string; item_b: string; interaction: string; severity: Severity; recommendation: string };
type ProtocolSuggestion = { area: string; suggestion: string; rationale: string };
type AttentionArea = { area: string; explanation: string; action: string };

type PractitionerReport = {
  clinical_summary: string;
  priority_findings: PriorityFinding[];
  exam_analysis: ExamAnalysis[];
  interaction_alerts: InteractionAlert[];
  protocol_suggestions: ProtocolSuggestion[];
  monitoring_points: string[];
  next_session_focus: string;
};

type PatientReport = {
  greeting: string;
  overall_message: string;
  positive_points: string[];
  attention_areas: AttentionArea[];
  next_steps: string[];
  encouragement: string;
};

type Report = { practitioner: PractitionerReport; patient: PatientReport };

function severityColor(s: Severity) {
  if (s === "alta") return "bg-red-50 text-red-600 border-red-100";
  if (s === "media") return "bg-amber-50 text-amber-600 border-amber-100";
  return "bg-[#F4F3EF] text-[#6B6A66] border-black/[.06]";
}

function severityLabel(s: Severity) {
  if (s === "alta") return "Alta";
  if (s === "media") return "Média";
  return "Baixa";
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-[8px] mb-[10px]">
      <div className="w-6 h-6 rounded-[6px] bg-[#F4F3EF] flex items-center justify-center text-[#6B6A66]">
        {icon}
      </div>
      <p className="text-[11px] font-medium tracking-[.08em] uppercase text-[#6B6A66]">{title}</p>
      {count !== undefined && (
        <span className="ml-auto text-[10px] font-medium text-[#A09E98] bg-[#F4F3EF] rounded-full px-[7px] py-[1px]">
          {count}
        </span>
      )}
    </div>
  );
}

function CollapsibleCard({ children, defaultOpen = true }: { children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-end px-[14px] py-[10px] border-b border-black/[.05] hover:bg-[#FAFAF8] transition"
      >
        {open ? <ChevronUp className="h-3 w-3 text-[#A09E98]" /> : <ChevronDown className="h-3 w-3 text-[#A09E98]" />}
      </button>
      {open && <div className="px-[16px] py-[14px]">{children}</div>}
    </div>
  );
}

function PractitionerView({ report }: { report: PractitionerReport }) {
  return (
    <div className="space-y-[12px]">
      {/* Clinical summary */}
      <div className="bg-[#0F1A2E] rounded-[12px] px-[16px] py-[14px]">
        <p className="text-[10px] font-medium tracking-[.10em] uppercase text-white/40 mb-[6px]">Síntese clínica</p>
        <p className="text-[13px] text-white leading-relaxed">{report.clinical_summary}</p>
      </div>

      {/* Priority findings */}
      {report.priority_findings?.length > 0 && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <SectionHeader icon={<AlertTriangle className="h-3 w-3" />} title="Achados prioritários" count={report.priority_findings.length} />
          <div className="space-y-[8px]">
            {report.priority_findings.map((f, i) => (
              <div key={i} className={`rounded-[8px] border px-[12px] py-[10px] ${severityColor(f.severity)}`}>
                <div className="flex items-start justify-between gap-[8px]">
                  <p className="text-[12px] font-medium">{f.finding}</p>
                  <span className={`text-[9px] font-semibold uppercase tracking-[.06em] rounded-full px-[7px] py-[2px] border shrink-0 ${severityColor(f.severity)}`}>
                    {severityLabel(f.severity)}
                  </span>
                </div>
                <p className="text-[11px] mt-[4px] opacity-80">{f.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interaction alerts */}
      {report.interaction_alerts?.length > 0 && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <SectionHeader icon={<Pill className="h-3 w-3" />} title="Interações detectadas" count={report.interaction_alerts.length} />
          <div className="space-y-[8px]">
            {report.interaction_alerts.map((ia, i) => (
              <div key={i} className={`rounded-[8px] border px-[12px] py-[10px] ${severityColor(ia.severity)}`}>
                <div className="flex items-center gap-[6px] mb-[4px]">
                  <span className="text-[11px] font-semibold">{ia.item_a}</span>
                  <span className="text-[10px] opacity-60">↔</span>
                  <span className="text-[11px] font-semibold">{ia.item_b}</span>
                  <span className={`ml-auto text-[9px] font-semibold uppercase tracking-[.06em] rounded-full px-[7px] py-[2px] border shrink-0 ${severityColor(ia.severity)}`}>
                    {severityLabel(ia.severity)}
                  </span>
                </div>
                <p className="text-[11px] opacity-80">{ia.interaction}</p>
                {ia.recommendation && (
                  <p className="text-[11px] font-medium mt-[4px] opacity-90">→ {ia.recommendation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exam analysis */}
      {report.exam_analysis?.length > 0 && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <SectionHeader icon={<FlaskConical className="h-3 w-3" />} title="Análise de exames" count={report.exam_analysis.length} />
          <div className="divide-y divide-black/[.04]">
            {report.exam_analysis.map((ea, i) => (
              <div key={i} className="py-[8px]">
                <div className="flex items-center gap-[6px]">
                  <p className="text-[12px] font-medium text-[#0F1A2E]">{ea.biomarker}</p>
                  <span className={`text-[10px] font-medium px-[7px] py-[1px] rounded-full ${
                    ea.status === "alto" ? "bg-red-50 text-red-500" :
                    ea.status === "baixo" ? "bg-amber-50 text-amber-600" :
                    "bg-[#E1F5EE] text-[#085041]"
                  }`}>
                    {ea.status}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B6A66] mt-[2px]">{ea.clinical_significance}</p>
                {ea.trend && <p className="text-[10px] text-[#A09E98] mt-[1px]">{ea.trend}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Protocol suggestions */}
      {report.protocol_suggestions?.length > 0 && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <SectionHeader icon={<Target className="h-3 w-3" />} title="Sugestões de protocolo" count={report.protocol_suggestions.length} />
          <div className="space-y-[8px]">
            {report.protocol_suggestions.map((ps, i) => (
              <div key={i} className="bg-[#FAFAF8] rounded-[8px] px-[12px] py-[10px]">
                <p className="text-[11px] font-medium text-[#0F6E56] mb-[2px]">{ps.area}</p>
                <p className="text-[12px] text-[#0F1A2E]">{ps.suggestion}</p>
                <p className="text-[11px] text-[#A09E98] mt-[3px]">{ps.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monitoring + next session */}
      <div className="grid gap-[10px] sm:grid-cols-2">
        {report.monitoring_points?.length > 0 && (
          <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
            <SectionHeader icon={<Eye className="h-3 w-3" />} title="Pontos de monitoramento" />
            <ul className="space-y-[5px]">
              {report.monitoring_points.map((m, i) => (
                <li key={i} className="flex items-start gap-[6px]">
                  <span className="h-[4px] w-[4px] rounded-full bg-[#A09E98] mt-[7px] shrink-0" />
                  <span className="text-[12px] text-[#0F1A2E]">{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.next_session_focus && (
          <div className="bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-[12px] px-[16px] py-[14px]">
            <SectionHeader icon={<Clock className="h-3 w-3" />} title="Foco da próxima sessão" />
            <p className="text-[13px] text-[#085041]">{report.next_session_focus}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PatientView({ report }: { report: PatientReport }) {
  return (
    <div className="space-y-[12px]">
      {/* Greeting */}
      <div className="bg-[#0F1A2E] rounded-[12px] px-[18px] py-[16px]">
        <p className="text-[16px] font-semibold text-white mb-[6px]">{report.greeting}</p>
        <p className="text-[13px] text-white/70 leading-relaxed">{report.overall_message}</p>
      </div>

      {/* Positive points */}
      {report.positive_points?.length > 0 && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <SectionHeader icon={<CheckCircle2 className="h-3 w-3" />} title="Pontos positivos" />
          <ul className="space-y-[6px]">
            {report.positive_points.map((p, i) => (
              <li key={i} className="flex items-start gap-[8px]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#0F6E56] shrink-0 mt-[2px]" />
                <span className="text-[13px] text-[#0F1A2E]">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Attention areas */}
      {report.attention_areas?.length > 0 && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <SectionHeader icon={<AlertTriangle className="h-3 w-3" />} title="Áreas de atenção" />
          <div className="space-y-[10px]">
            {report.attention_areas.map((aa, i) => (
              <div key={i} className="bg-[#FAFAF8] rounded-[10px] px-[14px] py-[12px]">
                <p className="text-[13px] font-semibold text-[#0F1A2E] mb-[4px]">{aa.area}</p>
                <p className="text-[12px] text-[#6B6A66] mb-[6px]">{aa.explanation}</p>
                <div className="flex items-start gap-[6px]">
                  <span className="text-[10px] font-medium text-[#0F6E56] bg-[#E1F5EE] rounded-full px-[7px] py-[2px] shrink-0">O que fazer</span>
                  <p className="text-[12px] text-[#0F6E56]">{aa.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next steps */}
      {report.next_steps?.length > 0 && (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
          <SectionHeader icon={<Target className="h-3 w-3" />} title="Próximos passos" />
          <ol className="space-y-[6px]">
            {report.next_steps.map((s, i) => (
              <li key={i} className="flex items-start gap-[10px]">
                <span className="w-5 h-5 rounded-full bg-[#0F1A2E] text-white text-[10px] font-semibold flex items-center justify-center shrink-0 mt-[1px]">
                  {i + 1}
                </span>
                <span className="text-[13px] text-[#0F1A2E]">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Encouragement */}
      {report.encouragement && (
        <div className="bg-[#E1F5EE] border border-[#0F6E56]/20 rounded-[12px] px-[16px] py-[14px]">
          <p className="text-[14px] text-[#085041] font-medium leading-relaxed">{report.encouragement}</p>
        </div>
      )}
    </div>
  );
}

export function HealthAgentPanel({ patientId }: { patientId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [patientName, setPatientName] = useState("");
  const [view, setView] = useState<"practitioner" | "patient">("practitioner");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const [waText, setWaText] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [waVoice, setWaVoice] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [waError, setWaError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro interno");
      setReport(data.report);
      setPatientName(data.patientName);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao gerar relatório");
    } finally {
      setLoading(false);
    }
  }

  function copyReport() {
    if (!report) return;
    const current = view === "practitioner" ? report.practitioner : report.patient;
    navigator.clipboard.writeText(JSON.stringify(current, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendWhatsApp(voice: boolean) {
    if (!report) return;
    const setter = voice ? setWaVoice : setWaText;
    setter("sending");
    setWaError(null);
    try {
      const endpoint = voice ? "/api/whatsapp/send-voice" : "/api/whatsapp/send";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, report, patientName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      setter("sent");
      setTimeout(() => setter("idle"), 4000);
    } catch (err: unknown) {
      setter("error");
      setWaError(err instanceof Error ? err.message : "Erro ao enviar WhatsApp");
    }
  }

  async function sendToPatient() {
    if (!report) return;
    setSending(true);
    setSendStatus("idle");
    setSendError(null);
    try {
      const res = await fetch("/api/health-agent/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, report, patientName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      setSendStatus("sent");
      setTimeout(() => setSendStatus("idle"), 4000);
    } catch (err: unknown) {
      setSendStatus("error");
      setSendError(err instanceof Error ? err.message : "Erro ao enviar email");
    } finally {
      setSending(false);
    }
  }

  function copyPatientText() {
    if (!report) return;
    const p = report.patient;
    const text = [
      p.greeting,
      "",
      p.overall_message,
      "",
      "✅ Pontos positivos:",
      ...(p.positive_points ?? []).map((x) => `• ${x}`),
      "",
      "📌 Áreas de atenção:",
      ...(p.attention_areas ?? []).map((a) => `• ${a.area}: ${a.explanation}\n  → ${a.action}`),
      "",
      "🎯 Próximos passos:",
      ...(p.next_steps ?? []).map((s, i) => `${i + 1}. ${s}`),
      "",
      p.encouragement,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!report) {
    return (
      <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[18px]">
        <div className="flex items-center gap-[10px] mb-[14px]">
          <div className="w-9 h-9 rounded-[10px] bg-[#0F1A2E] flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-[#0F6E56]" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#0F1A2E]">Agente de Saúde</p>
            <p className="text-[11px] text-[#A09E98]">Análise integrativa · Exames · Interações · Relatórios</p>
          </div>
        </div>

        <p className="text-[12px] text-[#6B6A66] leading-relaxed mb-[14px]">
          Analisa todos os dados do paciente — exames, medicamentos, suplementos, sessões e formulários — e gera um relatório técnico para você e um relatório simplificado para enviar ao paciente.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-[8px] px-[12px] py-[8px] mb-[12px]">
            <p className="text-[12px] text-red-600">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-[7px] text-[13px] font-medium text-white bg-[#0F1A2E] hover:bg-[#1a2d4a] disabled:opacity-50 rounded-[10px] py-[11px] transition"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando dados do paciente…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Gerar análise e relatórios
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-[12px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <div className="w-7 h-7 rounded-[8px] bg-[#0F1A2E] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-[#0F6E56]" />
          </div>
          <p className="text-[13px] font-semibold text-[#0F1A2E]">Relatório — {patientName}</p>
        </div>
        <div className="flex items-center gap-[6px]">
          {view === "patient" && (
            <>
              {/* Email */}
              <button
                type="button"
                onClick={sendToPatient}
                disabled={sending}
                title="Enviar por email"
                className={[
                  "flex items-center gap-[4px] text-[11px] font-medium rounded-[6px] px-[9px] py-[5px] border transition",
                  sendStatus === "sent"
                    ? "bg-[#E1F5EE] text-[#085041] border-[#0F6E56]/20"
                    : sendStatus === "error"
                    ? "bg-red-50 text-red-600 border-red-100"
                    : "bg-white text-[#6B6A66] border-black/[.08] hover:bg-[#F4F3EF] disabled:opacity-40",
                ].join(" ")}
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : sendStatus === "sent" ? <Check className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                {sending ? "…" : sendStatus === "sent" ? "Email enviado" : "Email"}
              </button>

              {/* WhatsApp texto */}
              <button
                type="button"
                onClick={() => sendWhatsApp(false)}
                disabled={waText === "sending"}
                title="Enviar via WhatsApp (texto)"
                className={[
                  "flex items-center gap-[4px] text-[11px] font-medium rounded-[6px] px-[9px] py-[5px] border transition",
                  waText === "sent"
                    ? "bg-[#E1F5EE] text-[#085041] border-[#0F6E56]/20"
                    : waText === "error"
                    ? "bg-red-50 text-red-600 border-red-100"
                    : "bg-[#25D366] text-white border-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-40",
                ].join(" ")}
              >
                {waText === "sending" ? <Loader2 className="h-3 w-3 animate-spin" /> : waText === "sent" ? <Check className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                {waText === "sending" ? "…" : waText === "sent" ? "Enviado" : "WhatsApp"}
              </button>

              {/* WhatsApp voz */}
              <button
                type="button"
                onClick={() => sendWhatsApp(true)}
                disabled={waVoice === "sending"}
                title="Enviar via WhatsApp (mensagem de voz)"
                className={[
                  "flex items-center gap-[4px] text-[11px] font-medium rounded-[6px] px-[9px] py-[5px] border transition",
                  waVoice === "sent"
                    ? "bg-[#E1F5EE] text-[#085041] border-[#0F6E56]/20"
                    : waVoice === "error"
                    ? "bg-red-50 text-red-600 border-red-100"
                    : "bg-[#0F1A2E] text-white border-[#0F1A2E] hover:bg-[#1a2d4a] disabled:opacity-40",
                ].join(" ")}
              >
                {waVoice === "sending" ? <Loader2 className="h-3 w-3 animate-spin" /> : waVoice === "sent" ? <Check className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                {waVoice === "sending" ? "…" : waVoice === "sent" ? "Enviado" : "Voz"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={view === "patient" ? copyPatientText : copyReport}
            className={[
              "flex items-center gap-[4px] text-[11px] font-medium rounded-[6px] px-[9px] py-[5px] border transition",
              copied ? "bg-[#E1F5EE] text-[#085041] border-[#0F6E56]/20" : "bg-white text-[#6B6A66] border-black/[.08] hover:bg-[#F4F3EF]",
            ].join(" ")}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-[4px] text-[11px] font-medium text-[#6B6A66] border border-black/[.08] hover:bg-[#F4F3EF] rounded-[6px] px-[9px] py-[5px] transition disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-[4px] bg-[#F4F3EF] rounded-[10px] p-[3px]">
        <button
          type="button"
          onClick={() => setView("practitioner")}
          className={[
            "flex-1 flex items-center justify-center gap-[5px] text-[11px] font-medium rounded-[8px] py-[7px] transition",
            view === "practitioner" ? "bg-white text-[#0F1A2E] shadow-sm" : "text-[#A09E98] hover:text-[#6B6A66]",
          ].join(" ")}
        >
          <Stethoscope className="h-3 w-3" /> Relatório clínico
        </button>
        <button
          type="button"
          onClick={() => setView("patient")}
          className={[
            "flex-1 flex items-center justify-center gap-[5px] text-[11px] font-medium rounded-[8px] py-[7px] transition",
            view === "patient" ? "bg-white text-[#0F1A2E] shadow-sm" : "text-[#A09E98] hover:text-[#6B6A66]",
          ].join(" ")}
        >
          <User className="h-3 w-3" /> Para o paciente
        </button>
      </div>

      {/* Send errors */}
      {sendStatus === "error" && sendError && (
        <div className="bg-red-50 border border-red-100 rounded-[8px] px-[12px] py-[8px]">
          <p className="text-[12px] text-red-600">{sendError}</p>
        </div>
      )}
      {(waText === "error" || waVoice === "error") && waError && (
        <div className="bg-red-50 border border-red-100 rounded-[8px] px-[12px] py-[8px]">
          <p className="text-[12px] text-red-600">{waError}</p>
        </div>
      )}

      {/* Report */}
      {view === "practitioner" ? (
        <PractitionerView report={report.practitioner} />
      ) : (
        <PatientView report={report.patient} />
      )}
    </div>
  );
}
