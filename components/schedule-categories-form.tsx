"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Check, AlertCircle, GripVertical, Pencil, X } from "lucide-react";
import { SortableList } from "@/components/sortable-list";
import { categoryIconComponent } from "@/components/schedule/appointment-visuals-ui";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  setSessionTypeCategoryAction,
  setSessionTypeColorOverrideAction,
  type CategoryState,
} from "@/app/settings/categorias-agenda/actions";
import {
  PRESET_COLORS,
  ICON_NAMES,
  DEFAULT_CATEGORY_COLOR,
  normalizeHexColor,
} from "@/lib/schedule-category-options";
import type { SessionTypeCategory, SessionTypeForCategory } from "@/services/session-type-category-service";

const inputCls =
  "w-full h-9 px-3 rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#A09E98] outline-none focus:border-[#0F6E56] transition";

// ── Swatch redondo de cor ──────────────────────────────────────────────────────
function Swatch({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block rounded-full border border-black/[.12] shrink-0"
      style={{ width: size, height: size, background: color }}
    />
  );
}

/**
 * Seletor de cor: presets clicáveis + input hex. Controlado por `value`/`onChange`.
 * Emite um <input type="hidden" name={name}> com o valor atual para envio via form.
 */
function ColorPicker({
  value,
  onChange,
  name,
  t,
}: {
  value: string;
  onChange: (hex: string) => void;
  name?: string;
  t: (k: string) => string;
}) {
  return (
    <div>
      {name && <input type="hidden" name={name} value={value} />}
      <div className="flex flex-wrap items-center gap-2">
        {PRESET_COLORS.map((c) => {
          const active = value.toUpperCase() === c.toUpperCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              title={c}
              aria-label={c}
              aria-pressed={active}
              className={`w-7 h-7 rounded-full transition ${active ? "ring-2 ring-offset-2 ring-[#0F1A2E]" : "hover:scale-105"}`}
              style={{ background: c }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Swatch color={value} size={22} />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            const norm = normalizeHexColor(raw);
            onChange(norm ?? raw);
          }}
          placeholder="#0F6E56"
          aria-label={t("colorHex")}
          className={`${inputCls} max-w-[140px] font-mono uppercase`}
        />
      </div>
    </div>
  );
}

/** Select de ícone tabler (rótulos i18n por nome). */
function IconSelect({ value, name, t }: { value: string; name: string; t: (k: string) => string }) {
  return (
    <select name={name} defaultValue={value} className={inputCls}>
      <option value="">{t("iconNone")}</option>
      {ICON_NAMES.map((ic) => (
        <option key={ic} value={ic}>
          {t(`icons.${ic}`)}
        </option>
      ))}
    </select>
  );
}

// ── Editor (criar/editar) de categoria ──────────────────────────────────────────
function CategoryEditor({
  category,
  onDone,
}: {
  category?: SessionTypeCategory;
  onDone: () => void;
}) {
  const t = useTranslations("settings.scheduleCategories");
  const isEdit = !!category;
  const [color, setColor] = useState<string>(category?.color ?? PRESET_COLORS[0]);
  const [state, formAction, isPending] = useActionState<CategoryState, FormData>(
    async (prev, fd) => {
      const r = isEdit ? await updateCategoryAction(prev, fd) : await createCategoryAction(prev, fd);
      if (r?.ok && !isEdit) setColor(PRESET_COLORS[0]);
      if (r?.ok && isEdit) onDone();
      return r;
    },
    null,
  );

  return (
    <form
      action={formAction}
      className={`space-y-3 ${isEdit ? "bg-[#FAFAF8] border border-black/[.07] rounded-[10px] p-3 mt-2" : "border-t border-black/[.07] pt-5"}`}
    >
      {isEdit && <input type="hidden" name="id" value={category.id} />}
      {!isEdit && <p className="text-[12px] font-medium text-[#6B6A66]">{t("addLabel")}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("name")} *</label>
          <input
            type="text"
            name="name"
            required
            defaultValue={category?.name ?? ""}
            placeholder={t("namePlaceholder")}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("icon")}</label>
          <IconSelect value={category?.icon ?? ""} name="icon" t={t} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("color")}</label>
          <ColorPicker value={color} onChange={setColor} name="color" t={t} />
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#0F6E56] text-white text-[13px] font-medium hover:bg-[#085041] disabled:opacity-50 transition"
        >
          {isEdit ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {isPending ? t("saving") : isEdit ? t("save") : t("add")}
        </button>
        {isEdit && (
          <button type="button" onClick={onDone} className="text-[12px] text-[#6B6A66] hover:text-[#0F1A2E] transition">
            {t("cancel")}
          </button>
        )}
        {state?.ok && !isEdit && (
          <span className="inline-flex items-center gap-1 text-[12px] text-[#0F6E56]">
            <Check className="h-3 w-3" /> {t("saved")}
          </span>
        )}
        {state?.error && (
          <span className="inline-flex items-center gap-1 text-[12px] text-red-500">
            <AlertCircle className="h-3 w-3" /> {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

// ── Linha de atribuição de um tipo de sessão ────────────────────────────────────
function SessionTypeRow({
  st,
  categories,
}: {
  st: SessionTypeForCategory;
  categories: SessionTypeCategory[];
}) {
  const t = useTranslations("settings.scheduleCategories");
  const [categoryId, setCategoryId] = useState<string>(st.category_id ?? "");
  const [override, setOverride] = useState<string>(st.color_override ?? "");
  const [editingColor, setEditingColor] = useState(false);

  const cat = categories.find((c) => c.id === categoryId);
  const effectiveColor = override || cat?.color || DEFAULT_CATEGORY_COLOR;

  function changeCategory(next: string) {
    setCategoryId(next);
    setSessionTypeCategoryAction(st.id, next || null);
  }

  function applyOverride(hex: string) {
    setOverride(hex);
    setSessionTypeColorOverrideAction(st.id, hex);
  }

  function clearOverride() {
    setOverride("");
    setEditingColor(false);
    setSessionTypeColorOverrideAction(st.id, null);
  }

  return (
    <div className="border border-black/[.07] rounded-[10px] px-3 py-2.5 bg-white">
      <div className="flex items-center gap-3 flex-wrap">
        <Swatch color={effectiveColor} size={16} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-[#0F1A2E]">{st.name}</span>
            {!st.is_active && (
              <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-[#FEE2E2] text-[#991B1B]">
                {t("inactive")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={categoryId}
            onChange={(e) => changeCategory(e.target.value)}
            aria-label={t("assignCategory")}
            className={`${inputCls} w-auto min-w-[140px]`}
          >
            <option value="">{t("noCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setEditingColor((v) => !v)}
            className="text-[11px] text-[#6B6A66] hover:text-[#0F1A2E] transition whitespace-nowrap"
          >
            {override ? t("editColor") : t("customColor")}
          </button>
        </div>
      </div>

      {editingColor && (
        <div className="mt-3 border-t border-black/[.06] pt-3">
          <ColorPicker value={override || effectiveColor} onChange={applyOverride} t={t} />
          <button
            type="button"
            onClick={clearOverride}
            className="mt-2 inline-flex items-center gap-1 text-[12px] text-[#6B6A66] hover:text-[#0F1A2E] transition"
          >
            <X className="h-3 w-3" /> {t("useCategoryColor")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Formulário completo ─────────────────────────────────────────────────────────
export function ScheduleCategoriesForm({
  categories,
  sessionTypes,
}: {
  categories: SessionTypeCategory[];
  sessionTypes: SessionTypeForCategory[];
}) {
  const t = useTranslations("settings.scheduleCategories");
  const [editing, setEditing] = useState<string | null>(null);
  const [items, setItems] = useState(categories);
  useEffect(() => {
    setItems(categories);
  }, [categories]);

  function reorder(next: SessionTypeCategory[]) {
    setItems(next);
    reorderCategoriesAction(next.map((c) => c.id));
  }

  return (
    <div className="space-y-8">
      {/* Bloco 1: categorias */}
      <div className="space-y-6">
        <div>
          <p className="text-[12px] font-medium text-[#6B6A66] mb-2">{t("listLabel")}</p>
          {items.length === 0 ? (
            <p className="text-[13px] text-[#A09E98]">{t("empty")}</p>
          ) : (
            <>
              <p className="text-[11px] text-[#A09E98] mb-2">{t("dragHint")}</p>
              <SortableList
                items={items}
                getId={(c) => c.id}
                onReorder={reorder}
                className="space-y-2"
                render={(c, { setNodeRef, style, handleProps, isDragging }) => {
                  const Icon = categoryIconComponent(c.icon);
                  return (
                    <div
                      ref={setNodeRef}
                      style={style}
                      className={`border border-black/[.07] rounded-[10px] px-3 py-2.5 bg-white ${isDragging ? "shadow-md" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          {...handleProps}
                          className="shrink-0 cursor-grab active:cursor-grabbing text-[#C4C2BC] hover:text-[#6B6A66] touch-none p-0.5"
                          title={t("drag")}
                          aria-label={t("drag")}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <Swatch color={c.color} size={16} />
                        <Icon style={{ width: 15, height: 15, color: c.color }} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-medium text-[#0F1A2E]">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditing(editing === c.id ? null : c.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#6B6A66] hover:text-[#0F6E56] border border-black/[.08] transition"
                            title={t("edit")}
                          >
                            {editing === c.id ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(t("deleteConfirm"))) deleteCategoryAction(c.id);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#A09E98] hover:text-red-500 border border-black/[.08] transition"
                            title={t("delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {editing === c.id && <CategoryEditor category={c} onDone={() => setEditing(null)} />}
                    </div>
                  );
                }}
              />
            </>
          )}
        </div>

        {/* Adicionar categoria */}
        <CategoryEditor onDone={() => {}} />
      </div>

      {/* Bloco 2: atribuição por tipo de sessão */}
      <div className="border-t border-black/[.07] pt-6">
        <p className="text-[12px] font-medium text-[#6B6A66] mb-1">{t("assignLabel")}</p>
        <p className="text-[11px] text-[#A09E98] mb-3">{t("assignHint")}</p>
        {sessionTypes.length === 0 ? (
          <p className="text-[13px] text-[#A09E98]">{t("noSessionTypes")}</p>
        ) : (
          <div className="space-y-2">
            {sessionTypes.map((st) => (
              <SessionTypeRow key={st.id} st={st} categories={items} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
