import { FileText } from "lucide-react";
import { Card } from "@/components/card";
import { ButtonSecondary } from "@/components/button";
import type { FormTemplate } from "@/modules/forms/form-templates";

export function FormTemplateCard({ template }: { template: FormTemplate }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-axiel-background text-axiel-primary">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-axiel-text-primary">{template.name}</h3>
          <p className="mt-1 text-sm leading-6 text-axiel-text-secondary">{template.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-axiel-text-secondary">
        <span>{template.questions.length} questions</span>
        <ButtonSecondary type="button" className="px-4 py-2 text-sm">Use template</ButtonSecondary>
      </div>
    </Card>
  );
}
