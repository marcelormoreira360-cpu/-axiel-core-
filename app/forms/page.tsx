import Link from "next/link";
import { Shell } from "@/components/shell";
import { getAssessmentTemplates } from "@/services/assessment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { FileText, Plus, Pencil, ClipboardList, Download, Trash2 } from "lucide-react";
import { importQSNAAction, deleteTemplateAction } from "@/app/forms/actions";

export default async function FormsPage() {
  const profile = await getCurrentUserProfile();
  const clinicId = profile?.clinic_id ?? undefined;
  const templates = await getAssessmentTemplates(clinicId);

  const hasQSNA = templates.some((t) =>
    t.name.toLowerCase().includes("q-sna") || t.name.toLowerCase().includes("nervoso autônomo")
  );

  return (
    <Shell>
      <div className="flex items-start justify-between mb-[22px]">
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Formulários</h1>
          <p className="text-[12px] text-[#A09E98] mt-[2px]">
            {templates.length} {templates.length === 1 ? "modelo" : "modelos"} ativos
          </p>
        </div>
        {profile?.clinic_id && (
          <div className="flex items-center gap-[8px]">
            {!hasQSNA && (
              <form action={importQSNAAction}>
                <button
                  type="submit"
                  className="flex items-center gap-[5px] text-[11px] font-medium text-[#0F6E56] border border-[#0F6E56]/30 hover:bg-[#E1F5EE] rounded-[6px] px-[10px] py-[6px] transition"
                >
                  <Download className="h-3 w-3" /> Importar Q-SNA
                </button>
              </form>
            )}
            <Link
              href="/forms/new"
              className="flex items-center gap-1.5 text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] transition px-[14px] py-[7px] rounded-lg border border-black/[.12]"
            >
              <Plus className="h-3.5 w-3.5" /> Novo formulário
            </Link>
          </div>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="bg-white border border-black/[.07] rounded-[12px] px-[20px] py-[24px] text-center">
          <p className="text-[13px] text-[#A09E98] mb-[4px]">Nenhum formulário criado ainda.</p>
          <p className="text-[11px] text-[#D3D1C7]">
            Clique em "Importar Q-SNA" para adicionar o questionário do Sistema Nervoso Autônomo, ou crie um novo.
          </p>
        </div>
      ) : (
        <div className="space-y-[8px]">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-black/[.07] rounded-[12px] px-[16px] py-[14px] flex items-center justify-between"
            >
              <div className="flex items-center gap-[10px]">
                <div className="w-8 h-8 rounded-[8px] bg-[#F4F3EF] flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-[#A09E98]" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#0F1A2E]">{t.name}</p>
                  {t.description && (
                    <p className="text-[11px] text-[#A09E98] mt-[1px]">{t.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-[6px]">
                <form action={deleteTemplateAction.bind(null, t.id)}>
                  <button
                    type="submit"
                    className="flex items-center gap-[5px] text-[11px] text-[#A09E98] border border-black/[.08] hover:bg-red-50 hover:text-red-500 hover:border-red-200 rounded-[6px] px-[8px] py-[5px] transition"
                    onClick={(e) => { if (!confirm(`Remover "${t.name}"?`)) e.preventDefault(); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </form>
                <Link
                  href={`/forms/${t.id}/edit`}
                  className="flex items-center gap-[5px] text-[11px] text-[#6B6A66] border border-black/[.08] hover:bg-[#F4F3EF] rounded-[6px] px-[10px] py-[5px] transition"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </Link>
                <Link
                  href={`/forms/${t.id}`}
                  className="flex items-center gap-[5px] text-[11px] font-medium text-white bg-[#0F6E56] hover:bg-[#085041] rounded-[6px] px-[10px] py-[5px] transition"
                >
                  <ClipboardList className="h-3 w-3" /> Preencher
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
