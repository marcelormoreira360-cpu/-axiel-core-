import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Shell } from "@/components/shell";
import { getAssessmentTemplates } from "@/services/assessment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { getPatients } from "@/services/patient-service";
import { FileText, Plus, Pencil, ClipboardList } from "lucide-react";
import {
  importQSNAAction, importQRMAction, deleteTemplateAction,
  importPHQ9PTAction, importPHQ9ENAction, importGAD7PTAction, importGAD7ENAction,
  importHPAPTAction, importHPAENAction, importMSQENAction,
} from "@/app/forms/actions";
import { DeleteTemplateButton } from "@/app/forms/delete-template-button";
import { ShareFormButton } from "@/app/forms/share-form-button";
import { ImportTemplatesButton } from "@/app/forms/import-templates-button";
import { TEMPLATE_CATALOG } from "@/app/forms/forms-catalog";

export default async function FormsPage() {
  const t = await getTranslations("forms.list");
  const tSlots = await getTranslations("forms.slots");
  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;
  const [templates, patients] = await Promise.all([
    getAssessmentTemplates(clinicId),
    getPatients(clinicId),
  ]);

  const hasQSNA = templates.some((t) =>
    t.name.toLowerCase().includes("q-sna") || t.name.toLowerCase().includes("nervoso autônomo")
  );
  const hasQRM = templates.some((t) =>
    t.name.toLowerCase().includes("q.r.m") || t.name.toLowerCase().includes("rastreamento metabólico")
  );

  // Detect which catalog templates are already imported
  const keyDetectors: Record<string, (name: string) => boolean> = {
    "phq9-pt": (n) => n.includes("phq-9") && (n.includes("saúde") || n.includes("saude") || n.includes("paciente")),
    "phq9-en": (n) => n.includes("phq-9") && n.includes("patient health"),
    "gad7-pt": (n) => (n.includes("gad-7") || n.includes("tag")) && (n.includes("ansiedade") || n.includes("transtorno")),
    "gad7-en": (n) => n.includes("gad-7") && n.includes("generalized"),
    "hpa-pt":  (n) => n.includes("hpa") && (n.includes("eixo") || n.includes("avaliação")),
    "hpa-en":  (n) => n.includes("hpa") && n.includes("axis"),
    "msq-en":  (n) => n.includes("msq") || n.includes("medical symptoms"),
  };
  const importedKeys = new Set(
    templates.flatMap((t) => {
      const name = t.name.toLowerCase();
      return TEMPLATE_CATALOG.filter((c) => keyDetectors[c.key]?.(name)).map((c) => c.key);
    })
  );
  const availableToImport = TEMPLATE_CATALOG.map((c) => c.key).filter((k) => !importedKeys.has(k));

  const actionEntries = [
    { key: "phq9-pt", action: importPHQ9PTAction },
    { key: "phq9-en", action: importPHQ9ENAction },
    { key: "gad7-pt", action: importGAD7PTAction },
    { key: "gad7-en", action: importGAD7ENAction },
    { key: "hpa-pt",  action: importHPAPTAction  },
    { key: "hpa-en",  action: importHPAENAction  },
    { key: "msq-en",  action: importMSQENAction  },
  ];

  return (
    <Shell>
      <div className="flex items-start justify-between mb-[22px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">{t("title")}</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {t("count", { count: templates.length })}
          </p>
        </div>
        {profile?.clinic_id && (
          <div className="flex items-center gap-[8px]">
            {!hasQRM && (
              <form action={importQRMAction}>
                <button type="submit" className="flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[6px] px-[10px] py-[6px] transition">
                  {t("importQRM")}
                </button>
              </form>
            )}
            {!hasQSNA && (
              <form action={importQSNAAction}>
                <button type="submit" className="flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[6px] px-[10px] py-[6px] transition">
                  {t("importQSNA")}
                </button>
              </form>
            )}
            <ImportTemplatesButton available={availableToImport} actionEntries={actionEntries} />
            <Link
              href="/forms/new"
              className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-lg border border-black/[.12]"
            >
              <Plus className="h-3.5 w-3.5" /> {t("newForm")}
            </Link>
          </div>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[24px] text-center">
          <p className="text-[13px] text-[#A09E98] mb-[4px]">{t("empty")}</p>
          <p className="text-[11px] text-[#D3D1C7]">
            {t("emptyHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-[8px]">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px] flex items-center justify-between"
            >
              <div className="flex items-center gap-[10px]">
                <div className="w-8 h-8 rounded-[8px] bg-[#F4F3EF] flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-[#A09E98]" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#0F1A2E]">{tpl.name}</p>
                  {tpl.description && (
                    <p className="text-[11px] text-[#A09E98] mt-[1px]">{tpl.description}</p>
                  )}
                  {tpl.placement?.length > 0 && (
                    <div className="flex flex-wrap gap-[4px] mt-[5px]">
                      {tpl.placement.map((slot) => (
                        <span key={slot} className="text-[10px] px-[7px] py-[1px] rounded-full bg-[#E1F5EE] text-[#085041]">
                          {tSlots(slot)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-[6px]">
                <DeleteTemplateButton
                  action={deleteTemplateAction.bind(null, tpl.id)}
                  templateName={tpl.name}
                />
                <Link
                  href={`/forms/${tpl.id}/edit`}
                  className="flex items-center gap-[5px] text-[11px] text-[#6B6A66] border border-black/[.08] hover:bg-[#F4F3EF] rounded-[6px] px-[10px] py-[5px] transition"
                >
                  <Pencil className="h-3 w-3" /> {t("edit")}
                </Link>
                <ShareFormButton
                  templateId={tpl.id}
                  templateName={tpl.name}
                  patients={patients.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email ?? null }))}
                />
                <Link
                  href={`/forms/${tpl.id}`}
                  className="flex items-center gap-[5px] text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[6px] px-[10px] py-[5px] transition"
                >
                  <ClipboardList className="h-3 w-3" /> {t("fill")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
