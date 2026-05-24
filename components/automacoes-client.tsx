"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, CheckCircle2, XCircle, AlertCircle, Clock,
  MessageSquare, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Zap, BarChart2, History,
} from "lucide-react";
import type { AutomacaoRule } from "@/app/api/automacoes/route";
import type { AutomacaoHistoryItem } from "@/app/api/automacoes/history/route";

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function applyVariables(template: string) {
  return template
    .replace(/{{nome}}/g, "Maria")
    .replace(/{{horario}}/g, "14:30")
    .replace(/{{data}}/g, "segunda-feira, 25 de maio");
}

const STATUS_ICON: Record<string, React.ReactElement> = {
  sent: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />,
  failed: <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />,
  skipped: <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
};

const STATUS_LABEL: Record<string, string> = {
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Pulado",
};

const KEY_COLOR: Record<string, string> = {
  d_minus_1: "#3B82F6",
  nps: "#8B5CF6",
  d_plus_3: "#0F6E56",
  d_plus_30: "#F59E0B",
};

// ── Rule Card ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, onUpdated }: { rule: AutomacaoRule; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [draft, setDraft] = useState(rule.template);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toggling, setToggling] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const accentColor = KEY_COLOR[rule.key] ?? "#0F1A2E";

  async function toggle() {
    setToggling(true);
    try {
      await fetch("/api/automacoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: rule.key, action: "toggle", value: !rule.isEnabled }),
      });
      onUpdated();
    } finally {
      setToggling(false);
    }
  }

  async function saveTemplate() {
    setSaveError("");
    if (draft.trim().length < 10) { setSaveError("Template muito curto (mín. 10 caracteres)."); return; }
    if (draft.trim().length > 1500) { setSaveError("Template muito longo (máx. 1500 caracteres)."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/automacoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: rule.key, action: "template", value: draft }),
      });
      if (!res.ok) { setSaveError("Erro ao salvar."); return; }
      setEditingTemplate(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setDraft(rule.template);
    setEditingTemplate(true);
    setShowPreview(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingTemplate(false);
    setSaveError("");
    setDraft(rule.template);
  }

  function insertVariable(v: string) {
    const el = textareaRef.current;
    if (!el) { setDraft((d) => d + v); return; }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + v + draft.slice(end);
    setDraft(next);
    setTimeout(() => {
      el.setSelectionRange(start + v.length, start + v.length);
      el.focus();
    }, 0);
  }

  const isDefault = rule.template === rule.defaultTemplate;

  return (
    <div
      className={[
        "bg-white rounded-2xl border transition-shadow",
        rule.isEnabled ? "border-black/[.07] shadow-sm" : "border-black/[.05] opacity-70",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-5">
        {/* Color dot */}
        <div
          className="mt-0.5 w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: accentColor }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-semibold text-[#0F1A2E] leading-tight">{rule.title}</p>
            {!isDefault && (
              <span className="text-[9px] font-semibold uppercase tracking-[.1em] px-1.5 py-0.5 rounded-full bg-[#0F6E56]/10 text-[#0F6E56]">
                Personalizado
              </span>
            )}
          </div>
          <p className="text-[12px] text-black/45 mt-0.5">{rule.description}</p>
          <div className="flex items-center gap-1 mt-1.5">
            <Clock className="h-3 w-3 text-black/30" />
            <span className="text-[11px] text-black/40">{rule.timing}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="shrink-0 text-right mr-2 hidden sm:block">
          <p className="text-[18px] font-semibold text-[#0F1A2E] leading-none">{rule.sentLast30d}</p>
          <p className="text-[10px] text-black/35 mt-0.5">últimos 30d</p>
          {rule.sentTotal > 0 && (
            <p className="text-[10px] text-black/25 mt-0.5">{rule.sentTotal} total</p>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={toggle}
          disabled={toggling}
          className="shrink-0 transition-opacity"
          aria-label={rule.isEnabled ? "Desativar" : "Ativar"}
        >
          {toggling ? (
            <Loader2 className="h-5 w-5 animate-spin text-black/30" />
          ) : rule.isEnabled ? (
            <ToggleRight className="h-6 w-6 text-[#0F6E56]" />
          ) : (
            <ToggleLeft className="h-6 w-6 text-black/25" />
          )}
        </button>

        {/* Expand */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 text-black/30 hover:text-black/60 transition-colors"
          aria-label="Expandir"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-black/[.06] px-5 pb-5 pt-4 space-y-4">
          {/* Template editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35">
                Mensagem WhatsApp
              </p>
              <div className="flex items-center gap-2">
                {!editingTemplate && (
                  <button
                    onClick={() => setShowPreview((p) => !p)}
                    className="text-[11px] text-black/40 hover:text-[#0F1A2E] transition-colors flex items-center gap-1"
                  >
                    <MessageSquare className="h-3 w-3" />
                    {showPreview ? "Editar" : "Prévia"}
                  </button>
                )}
                {!editingTemplate && !showPreview && (
                  <button
                    onClick={startEdit}
                    className="text-[11px] font-medium text-[#0F6E56] hover:text-[#0a5a45] transition-colors"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>

            {/* Preview mode */}
            {showPreview && !editingTemplate && (
              <div className="rounded-xl bg-[#DCF8C6]/40 border border-[#25D366]/20 p-3">
                <p className="text-[11px] text-black/35 mb-2 font-medium">Como o paciente vai receber:</p>
                <div className="bg-white rounded-xl rounded-tl-sm shadow-sm px-3 py-2 max-w-[85%] inline-block">
                  <p className="text-[13px] text-[#111B21] whitespace-pre-wrap leading-relaxed">
                    {applyVariables(rule.template)}
                  </p>
                  <p className="text-[10px] text-black/35 text-right mt-1">14:32 ✓✓</p>
                </div>
              </div>
            )}

            {/* Static view */}
            {!showPreview && !editingTemplate && (
              <div className="rounded-xl bg-black/[.02] border border-black/[.06] p-3">
                <p className="text-[12px] text-[#0F1A2E] whitespace-pre-wrap leading-relaxed font-mono">
                  {rule.template}
                </p>
              </div>
            )}

            {/* Edit mode */}
            {editingTemplate && (
              <div className="space-y-2">
                {/* Variable chips */}
                <div className="flex gap-1.5 flex-wrap">
                  {rule.variables.map((v) => (
                    <button
                      key={v}
                      onClick={() => insertVariable(v)}
                      className="px-2 py-0.5 rounded-md bg-[#0F6E56]/8 text-[#0F6E56] text-[11px] font-mono font-medium hover:bg-[#0F6E56]/15 transition-colors border border-[#0F6E56]/20"
                    >
                      {v}
                    </button>
                  ))}
                  <span className="text-[11px] text-black/30 self-center">← clique para inserir</span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-black/[.12] bg-white px-3 py-2.5 text-[13px] text-[#0F1A2E] font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/30 focus:border-[#0F6E56]/50"
                  placeholder="Digite a mensagem..."
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {saveError && (
                      <p className="text-[11px] text-red-500">{saveError}</p>
                    )}
                    <p className="text-[11px] text-black/30">{draft.length} / 1500</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 rounded-lg text-[12px] text-black/50 hover:bg-black/[.04] transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveTemplate}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#0F1A2E] text-white hover:bg-[#1a2a3e] transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reset to default */}
          {!isDefault && !editingTemplate && (
            <button
              onClick={() => { setDraft(rule.defaultTemplate); startEdit(); }}
              className="text-[11px] text-black/35 hover:text-black/60 transition-colors underline underline-offset-2"
            >
              Restaurar template padrão
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export function AutomacoesClient() {
  const [rules, setRules] = useState<AutomacaoRule[]>([]);
  const [history, setHistory] = useState<AutomacaoHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"rules" | "history">("rules");

  const fetchData = useCallback(async () => {
    const [rulesRes, histRes] = await Promise.all([
      fetch("/api/automacoes"),
      fetch("/api/automacoes/history?limit=30"),
    ]);
    if (rulesRes.ok) setRules(await rulesRes.json());
    if (histRes.ok) setHistory(await histRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalSent = rules.reduce((s, r) => s + r.sentLast30d, 0);
  const activeCount = rules.filter((r) => r.isEnabled).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-black/25" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Regras ativas", value: `${activeCount} / ${rules.length}`, icon: ToggleRight, color: "#0F6E56" },
          { label: "Enviados (30d)", value: String(totalSent), icon: Zap, color: "#3B82F6" },
          { label: "Histórico total", value: String(history.length > 0 ? history.length + "+" : "—"), icon: BarChart2, color: "#8B5CF6" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-black/[.07] p-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/30">{label}</p>
              <Icon className="h-3.5 w-3.5" style={{ color }} />
            </div>
            <p className="text-[22px] font-semibold tracking-[-0.02em] text-[#0F1A2E]">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(["rules", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-3 py-1.5 rounded-lg text-[12px] font-medium transition flex items-center gap-1.5",
              tab === t
                ? "bg-[#0F1A2E] text-white"
                : "bg-white border border-black/[.10] text-black/60 hover:bg-black/[.04]",
            ].join(" ")}
          >
            {t === "rules" ? <Zap className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
            {t === "rules" ? "Regras" : "Histórico"}
          </button>
        ))}
      </div>

      {/* Rules tab */}
      {tab === "rules" && (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard key={rule.key} rule={rule} onUpdated={fetchData} />
          ))}
          <p className="text-[11px] text-black/30 text-center pt-1">
            As automações são enviadas diariamente via cron às 08:00.
          </p>
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="bg-white rounded-2xl border border-black/[.07] overflow-hidden">
          {history.length === 0 ? (
            <p className="text-[13px] text-black/35 text-center py-12">
              Nenhuma automação enviada ainda.
            </p>
          ) : (
            <div className="divide-y divide-black/[.04]">
              {history.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                  {STATUS_ICON[item.status]}
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: KEY_COLOR[item.ruleKey] ?? "#ccc" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#0F1A2E] truncate">{item.patientName}</p>
                    <p className="text-[11px] text-black/40">{item.ruleTitle}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-black/40">{timeAgo(item.sentAt)}</p>
                    <p className={[
                      "text-[10px] font-medium",
                      item.status === "sent" ? "text-emerald-500" : item.status === "failed" ? "text-red-400" : "text-amber-400",
                    ].join(" ")}>
                      {STATUS_LABEL[item.status]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
