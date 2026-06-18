"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Check, AlertCircle, ExternalLink } from "lucide-react";
import {
  createSupplementCatalogAction,
  deleteSupplementCatalogAction,
  toggleSupplementCatalogActiveAction,
  type CatalogState,
} from "@/app/settings/supplements/actions";
import type { SupplementCatalogItem } from "@/services/supplement-service";

const SOURCES = ["manipulacao_br", "dfh", "pure_encapsulations", "fullscript", "outro"] as const;

const inputCls =
  "w-full h-9 px-3 rounded-[8px] border border-black/[.10] text-[13px] text-[#0F1A2E] placeholder:text-[#A09E98] outline-none focus:border-[#0F6E56] transition";

export function SupplementCatalogForm({ initial }: { initial: SupplementCatalogItem[] }) {
  const t = useTranslations("settings.supplements");
  const [country, setCountry] = useState<"BR" | "US">("BR");
  const [state, formAction, isPending] = useActionState<CatalogState, FormData>(
    async (prev, fd) => createSupplementCatalogAction(prev, fd),
    null,
  );

  return (
    <div className="space-y-6">
      {/* Lista atual */}
      <div>
        <p className="text-[12px] font-medium text-[#6B6A66] mb-2">{t("listLabel")}</p>
        {initial.length === 0 ? (
          <p className="text-[13px] text-[#A09E98]">{t("empty")}</p>
        ) : (
          <div className="space-y-2">
            {initial.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 border border-black/[.07] rounded-[10px] px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-[#0F1A2E]">{item.name}</span>
                    <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">
                      {item.country} · {t(`source.${item.source}`)}
                    </span>
                    {!item.active && (
                      <span className="text-[10px] px-[7px] py-[2px] rounded-full bg-[#FEE2E2] text-[#991B1B]">
                        {t("inactive")}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#A09E98] mt-[2px]">
                    {[item.default_dosage, item.form].filter(Boolean).join(" · ")}
                  </p>
                  {item.buy_url && (
                    <a
                      href={item.buy_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#0F6E56] hover:underline mt-[2px]"
                    >
                      <ExternalLink className="h-3 w-3" /> {t("buyLink")}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleSupplementCatalogActiveAction(item.id, !item.active)}
                    className="text-[11px] text-[#6B6A66] hover:text-[#0F1A2E] transition"
                  >
                    {item.active ? t("deactivate") : t("activate")}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSupplementCatalogAction(item.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#A09E98] hover:text-red-500 border border-black/[.08] transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar item */}
      <form action={formAction} className="space-y-3 border-t border-black/[.07] pt-5">
        <p className="text-[12px] font-medium text-[#6B6A66]">{t("addLabel")}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("name")} *</label>
            <input type="text" name="name" required placeholder={t("namePlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("country")}</label>
            <select
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value as "BR" | "US")}
              className={inputCls}
            >
              <option value="BR">{t("countryBR")}</option>
              <option value="US">{t("countryUS")}</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("sourceLabel")}</label>
            <select name="source" className={inputCls} defaultValue={country === "US" ? "dfh" : "manipulacao_br"}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`source.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("defaultDosage")}</label>
            <input type="text" name="default_dosage" placeholder={t("dosagePlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("form")}</label>
            <input type="text" name="form" placeholder={t("formPlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("sku")}</label>
            <input type="text" name="sku" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] text-[#6B6A66] mb-1 block">
              {t("buyUrl")} {country === "US" ? "*" : t("buyUrlBrHint")}
            </label>
            <input
              type="url"
              name="buy_url"
              placeholder="https://..."
              disabled={country === "BR"}
              className={`${inputCls} disabled:bg-[#F4F3EF] disabled:text-[#A09E98]`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("notes")}</label>
            <input type="text" name="notes" placeholder={t("notesPlaceholder")} className={inputCls} />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-[#0F6E56] text-white text-[13px] font-medium hover:bg-[#085041] disabled:opacity-50 transition"
          >
            <Plus className="h-3.5 w-3.5" /> {isPending ? t("saving") : t("add")}
          </button>
          {state?.ok && (
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
    </div>
  );
}
