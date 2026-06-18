"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pill, Plus, X, Trash2, Check, ShieldCheck, ExternalLink, FileText } from "lucide-react";
import type {
  PatientSupplementRecommendation,
  SupplementCatalogItem,
} from "@/services/supplement-service";
import {
  createSupplementRecommendationAction,
  addSupplementItemAction,
  deleteSupplementItemAction,
  deleteSupplementRecommendationAction,
  approveSupplementRecommendationAction,
} from "@/app/patients/[id]/supplements/actions";

const inputCls =
  "w-full text-[13px] text-[#0F1A2E] bg-white border border-black/[.10] rounded-[8px] px-[10px] py-[8px] outline-none focus:border-[#0F6E56]/50 transition";

const STATUS_CLASSES: Record<string, string> = {
  draft:    "bg-[#F4F3EF] text-[#6B6A66]",
  reviewed: "bg-[#FFF8E7] text-[#633806]",
  approved: "bg-[#E1F5EE] text-[#085041]",
  sent:     "bg-[#E8F0FE] text-[#3B6BE4]",
};

// ── Add-item form (com auxílio do catálogo) ──────────────────────────────────
function AddItemForm({
  rec,
  patientId,
  catalog,
  nextIndex,
  onClose,
}: {
  rec: PatientSupplementRecommendation;
  patientId: string;
  catalog: SupplementCatalogItem[];
  nextIndex: number;
  onClose: () => void;
}) {
  const t = useTranslations("patientPanels.supplements");
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [buyUrl, setBuyUrl] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [sourceCountry, setSourceCountry] = useState(rec.output_type === "us_link" ? "US" : "BR");

  function pickCatalog(id: string) {
    setCatalogId(id);
    const item = catalog.find((c) => c.id === id);
    if (item) {
      setName(item.name);
      setDosage(item.default_dosage ?? "");
      setBuyUrl(item.buy_url ?? "");
      setSourceCountry(item.country);
    }
  }

  async function submit(formData: FormData) {
    await addSupplementItemAction(formData);
    onClose();
  }

  return (
    <form action={submit} className="mt-[8px] space-y-[8px] bg-[#FAFAF8] rounded-[10px] p-[12px]">
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="recommendation_id" value={rec.id} />
      <input type="hidden" name="sort_order" value={nextIndex} />
      <input type="hidden" name="source_country" value={sourceCountry} />

      {catalog.length > 0 && (
        <div>
          <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("fromCatalog")}</label>
          <select name="catalog_id" value={catalogId} onChange={(e) => pickCatalog(e.target.value)} className={inputCls}>
            <option value="">{t("freeItem")}</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.country})
              </option>
            ))}
          </select>
        </div>
      )}

      <input
        type="text"
        name="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("itemName")}
        className={inputCls}
      />
      <div className="grid grid-cols-2 gap-[8px]">
        <input
          type="text"
          name="dosage"
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          placeholder={t("dosage")}
          className={inputCls}
        />
        <input type="text" name="timing" placeholder={t("timing")} className={inputCls} />
        <input type="text" name="duration" placeholder={t("duration")} className={inputCls} />
        {rec.output_type === "us_link" && (
          <input
            type="url"
            name="buy_url"
            value={buyUrl}
            onChange={(e) => setBuyUrl(e.target.value)}
            placeholder={t("buyUrl")}
            className={inputCls}
          />
        )}
      </div>
      <input type="text" name="rationale" placeholder={t("itemRationale")} className={inputCls} />

      <div className="flex gap-[8px]">
        <button
          type="submit"
          className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[14px] py-[7px] transition"
        >
          {t("addItem")}
        </button>
        <button type="button" onClick={onClose} className="text-[#A09E98] hover:text-[#0F1A2E] transition">
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

// ── Output preview (saída) ────────────────────────────────────────────────────
function OutputPreview({
  rec,
  clinicName,
}: {
  rec: PatientSupplementRecommendation;
  clinicName: string;
}) {
  const t = useTranslations("patientPanels.supplements");
  if (rec.items.length === 0) return null;

  if (rec.output_type === "br_formula") {
    return (
      <div className="mt-[10px] border border-[#0F6E56]/20 rounded-[10px] overflow-hidden">
        <div className="bg-[#0F6E56] text-white px-[12px] py-[7px] flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium">{t("brFormulaTitle", { clinic: clinicName })}</span>
        </div>
        <div className="p-[12px] space-y-[6px]">
          {rec.items.map((it) => (
            <p key={it.id} className="text-[12px] text-[#0F1A2E]">
              <span className="font-medium">{it.name}</span>
              {[it.dosage, it.timing, it.duration].filter(Boolean).length > 0 && (
                <span className="text-[#6B6A66]">
                  {" — "}
                  {[it.dosage, it.timing, it.duration].filter(Boolean).join(" · ")}
                </span>
              )}
            </p>
          ))}
        </div>
      </div>
    );
  }

  // us_link
  return (
    <div className="mt-[10px] border border-[#3B6BE4]/20 rounded-[10px] p-[12px] space-y-[6px]">
      <p className="text-[11px] font-medium text-[#3B6BE4]">{t("usLinksTitle")}</p>
      {rec.items.map((it) => (
        <div key={it.id} className="text-[12px] text-[#0F1A2E]">
          <span className="font-medium">{it.name}</span>
          {it.dosage && <span className="text-[#6B6A66]"> — {it.dosage}</span>}
          {it.buy_url && (
            <a
              href={it.buy_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#0F6E56] hover:underline ml-2"
            >
              <ExternalLink className="h-3 w-3" /> {t("buy")}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Recommendation card ───────────────────────────────────────────────────────
function RecommendationCard({
  rec,
  patientId,
  catalog,
  clinicName,
}: {
  rec: PatientSupplementRecommendation;
  patientId: string;
  catalog: SupplementCatalogItem[];
  clinicName: string;
}) {
  const t = useTranslations("patientPanels.supplements");
  const [addingItem, setAddingItem] = useState(false);
  const isApproved = rec.status === "approved" || rec.status === "sent";

  return (
    <div className="border border-black/[.07] rounded-[12px] p-[14px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-semibold px-[8px] py-[2px] rounded-full ${STATUS_CLASSES[rec.status] ?? STATUS_CLASSES.draft}`}>
            {t(`status.${rec.status}`)}
          </span>
          <span className="text-[10px] px-[8px] py-[2px] rounded-full bg-[#F4F3EF] text-[#6B6A66]">
            {t(`outputType.${rec.output_type}`)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => deleteSupplementRecommendationAction(rec.id, patientId)}
          className="text-[#D3D1C7] hover:text-red-400 transition shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {rec.rationale_summary && (
        <p className="text-[12px] text-[#6B6A66] mt-[8px]">{rec.rationale_summary}</p>
      )}

      {/* Itens */}
      <div className="mt-[10px] space-y-[6px]">
        {rec.items.length === 0 ? (
          <p className="text-[12px] text-[#A09E98]">{t("noItems")}</p>
        ) : (
          rec.items.map((it) => (
            <div key={it.id} className="flex items-start gap-2 group">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#0F1A2E]">
                  <span className="font-medium">{it.name}</span>
                  {[it.dosage, it.timing, it.duration].filter(Boolean).length > 0 && (
                    <span className="text-[#6B6A66]"> · {[it.dosage, it.timing, it.duration].filter(Boolean).join(" · ")}</span>
                  )}
                </p>
                {it.rationale && <p className="text-[11px] text-[#A09E98]">{it.rationale}</p>}
              </div>
              {!isApproved && (
                <button
                  type="button"
                  onClick={() => deleteSupplementItemAction(it.id, patientId)}
                  className="opacity-0 group-hover:opacity-100 text-[#D3D1C7] hover:text-red-400 transition shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add item (apenas enquanto não aprovado) */}
      {!isApproved &&
        (addingItem ? (
          <AddItemForm
            rec={rec}
            patientId={patientId}
            catalog={catalog}
            nextIndex={rec.items.length}
            onClose={() => setAddingItem(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingItem(true)}
            className="flex items-center gap-[5px] text-[11px] font-medium text-[#A09E98] hover:text-[#0F6E56] transition mt-[8px]"
          >
            <Plus className="h-3 w-3" /> {t("addItem")}
          </button>
        ))}

      {/* Aprovar (gate humano) */}
      {!isApproved && rec.items.length > 0 && (
        <button
          type="button"
          onClick={() => approveSupplementRecommendationAction(rec.id, patientId)}
          className="flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[8px] px-[12px] py-[6px] transition mt-[12px]"
        >
          <ShieldCheck className="h-3.5 w-3.5" /> {t("approve")}
        </button>
      )}

      {/* Saída + nota do relatório (após aprovação) */}
      {isApproved && (
        <>
          <OutputPreview rec={rec} clinicName={clinicName} />
          <p className="text-[10px] text-[#0F6E56] mt-[8px] flex items-center gap-1">
            <Check className="h-3 w-3" /> {t("inReportNote")}
          </p>
        </>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export function PatientSupplementsPanel({
  recommendations,
  catalog,
  patientId,
  clinicName,
}: {
  recommendations: PatientSupplementRecommendation[];
  catalog: SupplementCatalogItem[];
  patientId: string;
  clinicName: string;
}) {
  const t = useTranslations("patientPanels.supplements");
  const [creating, setCreating] = useState(false);

  return (
    <div className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px]">
      <div className="flex items-center justify-between mb-[6px]">
        <div className="flex items-center gap-[6px]">
          <Pill className="h-4 w-4 text-[#A09E98]" />
          <p className="text-[13px] font-medium text-[#0F1A2E]">{t("title")} · {recommendations.length}</p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-[4px] text-[11px] font-medium text-[#0F6E56] hover:text-[#085041] transition"
          >
            <Plus className="h-3 w-3" /> {t("newRecommendation")}
          </button>
        )}
      </div>

      {/* Disclaimer de compliance (sempre visível) */}
      <p className="text-[10px] text-[#A09E98] leading-snug mb-[12px] border-l-2 border-[#D9A441]/40 pl-2">
        {t("disclaimer")}
      </p>

      {/* Criar recomendação */}
      {creating && (
        <form
          action={async (fd) => {
            await createSupplementRecommendationAction(fd);
            setCreating(false);
          }}
          className="space-y-[8px] mb-[12px] bg-[#FAFAF8] rounded-[10px] p-[12px]"
        >
          <input type="hidden" name="patient_id" value={patientId} />
          <div>
            <label className="text-[11px] text-[#6B6A66] mb-1 block">{t("outputTypeLabel")}</label>
            <select name="output_type" className={inputCls} defaultValue="br_formula">
              <option value="br_formula">{t("outputType.br_formula")}</option>
              <option value="us_link">{t("outputType.us_link")}</option>
            </select>
          </div>
          <textarea
            name="rationale_summary"
            rows={2}
            placeholder={t("rationalePlaceholder")}
            className={`${inputCls} resize-none`}
          />
          <div className="flex gap-[8px]">
            <button
              type="submit"
              className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[8px] px-[14px] py-[7px] transition"
            >
              {t("create")}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="text-[#A09E98] hover:text-[#0F1A2E] transition">
              <X className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      {recommendations.length === 0 && !creating ? (
        <p className="text-[12px] text-[#A09E98]">{t("empty")}</p>
      ) : (
        <div className="space-y-[10px]">
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              patientId={patientId}
              catalog={catalog}
              clinicName={clinicName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
