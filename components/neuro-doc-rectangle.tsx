"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Pencil, FileDown } from "lucide-react";
import type { AiInsightOutput, NeuroProtocoloSuplementacao } from "@/lib/types";
import { InsightEditor } from "@/components/insight-editor";
import { SupplementEditor } from "@/components/supplement-editor";
import { ButtonPrimary } from "@/components/button";

/**
 * Retângulo de documento (Doc 1 / Doc 2 Suplementação) na mesa de revisão.
 *
 * A barra do retângulo traz, à ESQUERDA do ícone de expandir, os botões Editar e PDF:
 * dá para editar ou abrir o PDF SEM precisar expandir o documento (o editor abre em um
 * painel próprio abaixo da barra, controlado por `editing`, sem mexer no preview). O
 * chevron continua expandindo/recolhendo o preview do conteúdo, como antes.
 *
 * Cliente porque coordena dois estados independentes (preview aberto × editor aberto) e
 * comanda o editor em modo controlado (open/onOpenChange) — assim o "X" do editor fecha
 * o painel. Os editores (InsightEditor/SupplementEditor) são importados aqui.
 */
type Base = {
  label: string;
  title: string;
  wrapperClass: string;
  labelClass: string;
  /** URL do PDF (relatório ou suplementação). */
  pdfHref: string;
  /** Preview do conteúdo do documento (aparece ao expandir). */
  children?: ReactNode;
};

type Props = Base &
  (
    | { variant: "report"; patientId: string; insightId: string; output: AiInsightOutput }
    | {
        variant: "supplement";
        patientId: string;
        insightId: string;
        protocolo: NeuroProtocoloSuplementacao | null | undefined;
        country: "BR" | "US";
        isFinal: boolean;
        hasSupplement: boolean;
        sendAction: (formData: FormData) => void | Promise<void>;
      }
  );

const ACTION_CLS =
  "inline-flex items-center gap-1.5 rounded-lg border border-black/[.08] dark:border-white/[.14] px-2.5 py-1.5 text-[11px] font-medium text-axiel-text-secondary transition hover:bg-black/[.03] dark:hover:bg-white/[.06] hover:text-axiel-text-primary dark:hover:text-[#E8E6E2]";

export function NeuroDocRectangle(props: Props) {
  const { label, title, wrapperClass, labelClass, pdfHref, children } = props;
  const t = useTranslations("insights.reviewCard");
  const tc = useTranslations("common.actions");
  const [openPreview, setOpenPreview] = useState(false);
  const [editing, setEditing] = useState(false);

  const pdfLabel = props.variant === "report" ? t("downloadReport") : t("downloadSupplement");

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between gap-3 p-5">
        <span className="min-w-0">
          <span className={labelClass}>{label}</span>
          <span className="block text-[15px] font-semibold text-[#0F1A2E]">{title}</span>
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => setEditing((v) => !v)} className={ACTION_CLS} aria-pressed={editing}>
            <Pencil className="h-3.5 w-3.5" /> {tc("edit")}
          </button>
          <a href={pdfHref} target="_blank" rel="noopener noreferrer" className={ACTION_CLS}>
            <FileDown className="h-3.5 w-3.5" /> {pdfLabel}
          </a>
          <button
            type="button"
            onClick={() => setOpenPreview((v) => !v)}
            aria-label={t("viewDetails")}
            aria-expanded={openPreview}
            className="p-1 text-[#A09E98] hover:text-[#0F1A2E] dark:hover:text-[#E8E6E2] transition"
          >
            <ChevronDown className={`h-4 w-4 transition ${openPreview ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Editor: abre em painel próprio, sem precisar expandir o preview. */}
      {editing ? (
        <div className="px-5 pb-5 border-t border-black/[.06] dark:border-white/[.10] pt-4">
          {props.variant === "report" ? (
            <InsightEditor patientId={props.patientId} insightId={props.insightId} output={props.output} open onOpenChange={setEditing} />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-end">
                <span className="rounded-full bg-black/[.04] dark:bg-white/[.08] px-2 py-[2px] text-[11px] font-medium text-axiel-text-secondary">
                  {props.country === "US" ? t("supplementUs") : t("supplementBr")}
                </span>
              </div>
              <SupplementEditor patientId={props.patientId} insightId={props.insightId} protocolo={props.protocolo} country={props.country} open onOpenChange={setEditing} />
              {props.isFinal && props.hasSupplement ? (
                <form action={props.sendAction}>
                  <ButtonPrimary type="submit">{t("sendSupplement")}</ButtonPrimary>
                </form>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/* Preview do conteúdo (expandível pelo chevron). */}
      {openPreview ? <div className="px-5 pb-5">{children}</div> : null}
    </div>
  );
}
