"use client";

import type { TemplateWithStructure } from "@/lib/types";
import { PublicAssessmentForm } from "@/components/public-assessment-form";

/**
 * Fluxo do link PÚBLICO de captação: quem abre ainda NÃO é paciente.
 * ORDEM: responde o questionário PRIMEIRO e só DEPOIS preenche os dados
 * (nome, data de nascimento e e-mail obrigatórios; telefone opcional). Vira Lead
 * junto com a submissão. Toda a lógica vive no PublicAssessmentForm com
 * captureContactAtEnd — este wrapper apenas o injeta em modo captação.
 */
export function PublicCaptureForm({
  template,
  token,
}: {
  template: TemplateWithStructure;
  token: string;
}) {
  return <PublicAssessmentForm template={template} token={token} publicMode captureContactAtEnd />;
}
