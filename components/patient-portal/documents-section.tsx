"use client";

import { useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { FileUp, FileText, Image } from "lucide-react";
import { type PatientPortalData } from "@/services/patient-portal-service";
import { uploadPortalDocumentAction } from "@/app/p/[token]/actions";

const FILE_TYPE_ICON: Record<string, React.ReactNode> = {
  pdf:   <FileText className="h-4 w-4 text-red-400" />,
  image: <Image className="h-4 w-4 text-blue-400" />,
};

// ── Documentos ────────────────────────────────────────────────────────────────
export function DocumentsSection({
  initialDocuments,
  rawToken,
}: {
  initialDocuments: PatientPortalData["documents"];
  rawToken: string;
}) {
  const t = useTranslations("portal.dashboard");
  const locale = useLocale();

  // Document upload state
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadErrored, setUploadErrored] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState(initialDocuments ?? []);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadPortalDocumentAction(rawToken, fd);
    setUploading(false);
    if (result.ok) {
      setUploadErrored(false);
      setUploadMsg(t("uploadSuccess"));
      setDocuments((prev) => [
        { id: crypto.randomUUID(), file_name: file.name, file_type: file.type.startsWith("image") ? "image" : file.type === "application/pdf" ? "pdf" : "other", source: "portal", created_at: new Date().toISOString() },
        ...prev,
      ]);
    } else {
      setUploadErrored(true);
      setUploadMsg(result.error ?? t("uploadErr"));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="bg-white rounded-2xl border border-black/[.07] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">{t("documentsTitle")}</p>
        <label className="flex items-center gap-1.5 cursor-pointer rounded-xl border border-black/[.10] px-3 py-1.5 text-xs font-medium text-black/60 hover:bg-black/[.04] transition">
          <FileUp className="h-3.5 w-3.5" />
          {uploading ? t("uploading") : t("uploadFile")}
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      {uploadMsg && (
        <p className={`text-xs ${uploadErrored ? "text-red-500" : "text-[#0F6E56]"}`}>
          {uploadMsg}
        </p>
      )}
      {documents.length === 0 ? (
        <p className="text-sm text-black/40">{t("noDocuments")}</p>

      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 py-1.5 border-b border-black/[.05] last:border-0">
              {FILE_TYPE_ICON[doc.file_type] ?? <FileText className="h-4 w-4 text-black/30" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#0F1A2E] truncate">{doc.file_name}</p>
                <p className="text-xs text-black/30">{new Date(doc.created_at).toLocaleDateString(locale)}</p>
              </div>
              {doc.source === "portal" && (
                <span className="text-[10px] text-black/30">{t("docYou")}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
