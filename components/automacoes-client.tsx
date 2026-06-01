"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2, CheckCircle2, XCircle, AlertCircle, Clock,
  MessageSquare, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Zap, BarChart2, History, Plus, Trash2,
} from "lucide-react";
import type { AutomacaoRule } from "@/app/api/automacoes/route";
import type { AutomacaoHistoryItem } from "@/app/api/automacoes/history/route";

type AutoT = (k: string, v?: Record<string, string | number>) => string;

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string, t: AutoT) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("agora");
  if (m < 60) return t("minsAgo", { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("hoursAgo", { h });
  return t("daysAgo", { d: Math.floor(h / 24) });
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

const STATUS_KEY: Record<string, string> = {
  sent: "statusSent",
  failed: "statusFailed",
  skipped: "statusSkipped",
};

const KEY_COLOR: Record<string, string> = {
  d_minus_1: "#3B82F6",
  nps: "#8B5CF6",
  d_plus_3: "#0F6E56",
  d_plus_30: "#F59E0B",
};

const CUSTOM_ACCENT = "#E85D3D";

// ── Rule Card ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, onUpdated, onDelete }: { rule: AutomacaoRule; onUpdated: () => void; onDelete?: () => void }) {
  const t = useTranslations("automations.rule");
  const [expanded, setExpanded] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [draft, setDraft] = useState(rule.template);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toggling, setToggling] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const accentColor = rule.isCustom ? CUSTOM_ACCENT : (KEY_COLOR[rule.key] ?? "#0F1A2E");

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
    if (draft.trim().length < 10) { setSaveError(t("tplTooShort")); return; }
    if (draft.trim().length > 1500) { setSaveError(t("tplTooLong")); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/automacoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: rule.key, action: "template", value: draft }),
      });
      if (!res.ok) { setSaveError(t("saveErr")); return; }
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

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      if (rule.isCustom) {
        const ruleId = rule.key.replace("custom_", "");
        await fetch("/api/automacoes", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ruleId }),
        });
      } else {
        await fetch("/api/automacoes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: rule.key, action: "delete" }),
        });
      }
      onDelete?.();
      onUpdated();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
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
                {t("custom")}
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
          <p className="text-[10px] text-black/35 mt-0.5">{t("last30d")}</p>
          {rule.sentTotal > 0 && (
            <p className="text-[10px] text-black/25 mt-0.5">{t("total", { count: rule.sentTotal })}</p>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={toggle}
          disabled={toggling}
          className="shrink-0 transition-opacity"
          aria-label={rule.isEnabled ? t("disable") : t("enable")}
        >
          {toggling ? (
            <Loader2 className="h-5 w-5 animate-spin text-black/30" />
          ) : rule.isEnabled ? (
            <ToggleRight className="h-6 w-6 text-[#0F6E56]" />
          ) : (
            <ToggleLeft className="h-6 w-6 text-black/25" />
          )}
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={[
            "shrink-0 transition-colors",
            confirmDelete
              ? "text-red-500 hover:text-red-600"
              : "text-black/20 hover:text-red-400",
          ].join(" ")}
          aria-label={confirmDelete ? t("confirmDelete") : t("deleteRule")}
          title={confirmDelete ? t("deleteHint") : t("deleteRule")}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>

        {/* Expand */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 text-black/30 hover:text-black/60 transition-colors"
          aria-label={t("expand")}
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
                {t("msgWhatsapp")}
              </p>
              <div className="flex items-center gap-2">
                {!editingTemplate && (
                  <button
                    onClick={() => setShowPreview((p) => !p)}
                    className="text-[11px] text-black/40 hover:text-[#0F1A2E] transition-colors flex items-center gap-1"
                  >
                    <MessageSquare className="h-3 w-3" />
                    {showPreview ? t("edit") : t("preview")}
                  </button>
                )}
                {!editingTemplate && !showPreview && (
                  <button
                    onClick={startEdit}
                    className="text-[11px] font-medium text-[#0F6E56] hover:text-[#0a5a45] transition-colors"
                  >
                    {t("edit")}
                  </button>
                )}
              </div>
            </div>

            {/* Preview mode */}
            {showPreview && !editingTemplate && (
              <div className="rounded-xl bg-[#DCF8C6]/40 border border-[#25D366]/20 p-3">
                <p className="text-[11px] text-black/35 mb-2 font-medium">{t("previewHow")}</p>
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
                  <span className="text-[11px] text-black/30 self-center">{t("clickInsert")}</span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-black/[.12] bg-white px-3 py-2.5 text-[13px] text-[#0F1A2E] font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/30 focus:border-[#0F6E56]/50"
                  placeholder={t("msgPlaceholder")}
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
                      {t("cancel")}
                    </button>
                    <button
                      onClick={saveTemplate}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-[#0F1A2E] text-white hover:bg-[#1a2a3e] transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {t("save")}
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
              {t("restoreDefault")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create Rule Form ──────────────────────────────────────────────────────────

function CreateRuleForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const t = useTranslations("automations.createForm");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [offsetDays, setOffsetDays] = useState(1);
  const [triggerType, setTriggerType] = useState<"before_session" | "after_session">("after_session");
  const [template, setTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(v: string) {
    const el = textareaRef.current;
    if (!el) { setTemplate((d) => d + v); return; }
    const start = el.selectionStart ?? template.length;
    const end = el.selectionEnd ?? template.length;
    const next = template.slice(0, start) + v + template.slice(end);
    setTemplate(next);
    setTimeout(() => {
      el.setSelectionRange(start + v.length, start + v.length);
      el.focus();
    }, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) { setError(t("errTitle")); return; }
    if (template.trim().length < 10) { setError(t("errShort")); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/automacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), offsetDays, triggerType, template: template.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? t("errCreate"));
        return;
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  const VARIABLES = ["{{nome}}", "{{horario}}", "{{data}}"];

  return (
    <div className="bg-white rounded-2xl border border-[#E85D3D]/30 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[#0F1A2E]">{t("title")}</p>
        <button onClick={onCancel} className="text-[11px] text-black/40 hover:text-black/60 transition-colors">{t("cancel")}</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Title */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 block mb-1">{t("fTitle")}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("fTitlePlaceholder")}
            className="w-full rounded-xl border border-black/[.12] bg-white px-3 py-2 text-[13px] text-[#0F1A2E] focus:outline-none focus:ring-2 focus:ring-[#E85D3D]/30 focus:border-[#E85D3D]/50"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 block mb-1">{t("fDesc")} <span className="text-black/25 normal-case font-normal">{t("fDescOpt")}</span></label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("fDescPlaceholder")}
            className="w-full rounded-xl border border-black/[.12] bg-white px-3 py-2 text-[13px] text-[#0F1A2E] focus:outline-none focus:ring-2 focus:ring-[#E85D3D]/30 focus:border-[#E85D3D]/50"
          />
        </div>

        {/* Timing */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 block mb-1">{t("fDays")}</label>
            <input
              type="number"
              min={0}
              max={365}
              value={offsetDays}
              onChange={(e) => setOffsetDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full rounded-xl border border-black/[.12] bg-white px-3 py-2 text-[13px] text-[#0F1A2E] focus:outline-none focus:ring-2 focus:ring-[#E85D3D]/30 focus:border-[#E85D3D]/50"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 block mb-1">{t("fWhen")}</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as "before_session" | "after_session")}
              className="w-full rounded-xl border border-black/[.12] bg-white px-3 py-2 text-[13px] text-[#0F1A2E] focus:outline-none focus:ring-2 focus:ring-[#E85D3D]/30 focus:border-[#E85D3D]/50"
            >
              <option value="before_session">{t("whenBefore")}</option>
              <option value="after_session">{t("whenAfter")}</option>
            </select>
          </div>
        </div>

        {/* Template */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[.12em] text-black/35 block mb-1">{t("fMsg")}</label>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="px-2 py-0.5 rounded-md bg-[#E85D3D]/8 text-[#E85D3D] text-[11px] font-mono font-medium hover:bg-[#E85D3D]/15 transition-colors border border-[#E85D3D]/20"
              >
                {v}
              </button>
            ))}
            <span className="text-[11px] text-black/30 self-center">{t("clickInsert")}</span>
          </div>
          <textarea
            ref={textareaRef}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={5}
            placeholder={t("msgPlaceholder")}
            className="w-full rounded-xl border border-black/[.12] bg-white px-3 py-2.5 text-[13px] text-[#0F1A2E] font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#E85D3D]/30 focus:border-[#E85D3D]/50"
          />
          <p className="text-[11px] text-black/30 mt-1 text-right">{template.length} / 1500</p>
        </div>

        {error && <p className="text-[12px] text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-[12px] text-black/50 hover:bg-black/[.04] transition"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl text-[12px] font-medium bg-[#E85D3D] text-white hover:bg-[#d04e30] transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("create")}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export function AutomacoesClient() {
  const t = useTranslations("automations.client");
  const [rules, setRules] = useState<AutomacaoRule[]>([]);
  const [history, setHistory] = useState<AutomacaoHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"rules" | "history">("rules");
  const [showCreateForm, setShowCreateForm] = useState(false);

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
          { label: t("kpiActiveRules"), value: `${activeCount} / ${rules.length}`, icon: ToggleRight, color: "#0F6E56" },
          { label: t("kpiSent30"), value: String(totalSent), icon: Zap, color: "#3B82F6" },
          { label: t("kpiTotalHistory"), value: String(history.length > 0 ? history.length + "+" : "—"), icon: BarChart2, color: "#8B5CF6" },
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
        {(["rules", "history"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={[
              "px-3 py-1.5 rounded-lg text-[12px] font-medium transition flex items-center gap-1.5",
              tab === tabKey
                ? "bg-[#0F1A2E] text-white"
                : "bg-white border border-black/[.10] text-black/60 hover:bg-black/[.04]",
            ].join(" ")}
          >
            {tabKey === "rules" ? <Zap className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
            {tabKey === "rules" ? t("tabRules") : t("tabHistory")}
          </button>
        ))}
      </div>

      {/* Rules tab */}
      {tab === "rules" && (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.key}
              rule={rule}
              onUpdated={fetchData}
              onDelete={fetchData}
            />
          ))}

          {/* Create form or button */}
          {showCreateForm ? (
            <CreateRuleForm
              onCreated={() => { setShowCreateForm(false); fetchData(); }}
              onCancel={() => setShowCreateForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-black/[.12] text-[12px] text-black/40 hover:text-[#E85D3D] hover:border-[#E85D3D]/40 hover:bg-[#E85D3D]/[.02] transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("newCustom")}
            </button>
          )}

          <p className="text-[11px] text-black/30 text-center pt-1">
            {t("cronNote")}
          </p>
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="bg-white rounded-2xl border border-black/[.07] overflow-hidden">
          {history.length === 0 ? (
            <p className="text-[13px] text-black/35 text-center py-12">
              {t("historyEmpty")}
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
                    <p className="text-[11px] text-black/40">{timeAgo(item.sentAt, t)}</p>
                    <p className={[
                      "text-[10px] font-medium",
                      item.status === "sent" ? "text-emerald-500" : item.status === "failed" ? "text-red-400" : "text-amber-400",
                    ].join(" ")}>
                      {STATUS_KEY[item.status] ? t(STATUS_KEY[item.status]) : item.status}
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
