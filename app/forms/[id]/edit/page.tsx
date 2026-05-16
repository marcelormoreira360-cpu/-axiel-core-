import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { getTemplateWithStructure } from "@/services/assessment-service";
import { getCurrentUserProfile } from "@/services/user-service";
import { AssessmentFormEditor } from "@/components/assessment-form-editor";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditFormPage({ params }: Props) {
  const { id } = await params;
  const [template, profile] = await Promise.all([
    getTemplateWithStructure(id),
    getCurrentUserProfile(),
  ]);
  if (!template || !profile?.clinic_id) notFound();

  return (
    <Shell>
      <div className="flex items-center gap-[10px] mb-[24px]">
        <Link
          href={`/forms/${id}`}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black/[.08] text-[#A09E98] hover:text-[#0F1A2E] hover:bg-[#F4F3EF] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <div>
          <h1 className="text-[18px] font-medium tracking-[-0.025em] text-[#0F1A2E]">Editar formulário</h1>
          <p className="text-[12px] text-[#A09E98] mt-[1px]">{template.name}</p>
        </div>
      </div>
      <AssessmentFormEditor template={template} />
    </Shell>
  );
}
