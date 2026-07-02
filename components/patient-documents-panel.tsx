"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { PatientDocument } from "@/services/patient-document-service";
import { deleteDocumentAction } from "@/app/patients/[id]/documentos/actions";

const SOURCE_COLORS: Record<PatientDocument["source"], string> = {
  clinic:  "bg-[#E6F1FB] dark:bg-[#3B6BE4]/[.15] text-[#0C447C] dark:text-[#8FBFF5]",
  intake:  "bg-[#E1F5EE] dark:bg-[#0F6E56]/20 text-[#085041] dark:text-[#9FE1CB]",
  portal:  "bg-[#F0E8FB] dark:bg-[#5C2D91]/[.25] text-[#5C2D91] dark:text-[#C9B3E8]",
};

function FileTypeIcon({ type }: { type: PatientDocument["file_type"] }) {
  if (type === "image") {
    return (
      <svg className="h-5 w-5 text-[#0C447C] dark:text-[#8FBFF5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    );
  }
  if (type === "pdf") {
    return (
      <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    );
  }
  if (type === "text") {
    return (
      <svg className="h-5 w-5 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function fmtSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return ` · ${(bytes / 1024).toFixed(0)} KB`;
  return ` · ${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  documents: PatientDocument[];
  patientId: string;
  intakeUrl?: string;
}

export function PatientDocumentsPanel({ documents, patientId, intakeUrl }: Props) {
  const t = useTranslations("patientPanels.documents");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(docId: string, fileName: string) {
    if (!confirm(t("confirmDelete", { name: fileName }))) return;
    startTransition(async () => {
      await deleteDocumentAction(docId, patientId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-black/[.07] bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-black/[.05] dark:border-white/[.06]">
        <div>
          <p className="text-[13px] font-semibold text-[#0F1A2E]">{t("title")}</p>
          <p className="text-[11px] text-[#A09E98] mt-0.5">
            {documents.length === 0 ? t("none") : t("count", { count: documents.length })}
          </p>
        </div>
        {intakeUrl && (
          <a
            href={intakeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-black/15 dark:border-white/15 px-3 py-1.5 text-[11px] font-medium text-[#6B6A66] hover:bg-[#F4F3EF] dark:hover:bg-white/[.06] transition"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            {t("patientLink")}
          </a>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4F3EF]">
            <svg className="h-6 w-6 text-[#A09E98]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <p className="text-[13px] text-[#A09E98]">
            {t("emptyTitle")}
            {intakeUrl && (
              <> {t("emptyShareBefore")} <a href={intakeUrl} target="_blank" className="text-[#0B1F3A] dark:text-[#E8E6E2] underline underline-offset-2">{t("emptyLinkText")}</a> {t("emptyShareAfter")}</>
            )}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-black/[.04] dark:divide-white/[.06]">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F4F3EF]">
                <FileTypeIcon type={doc.file_type} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#0F1A2E] truncate">{doc.file_name}</p>
                <p className="text-[11px] text-[#A09E98]">
                  {formatDate(doc.created_at, locale)}{fmtSize(doc.file_size)}
                </p>
              </div>

              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${SOURCE_COLORS[doc.source]}`}>
                {t(`source.${doc.source}`)}
              </span>

              <a
                href={`/api/documents/${doc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[#A09E98] hover:text-[#0B1F3A] dark:hover:text-[#E8E6E2] transition"
                title={t("download")}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </a>

              <button
                onClick={() => handleDelete(doc.id, doc.file_name)}
                disabled={isPending}
                className="shrink-0 text-[#A09E98] hover:text-red-500 transition disabled:opacity-40"
                title={t("delete")}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
