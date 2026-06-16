import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/**
 * Unificado no Neuro ID 360: o antigo "Agente de Saúde" foi substituído pelo fluxo de
 * AI Insights (gerar → revisar os 3 documentos → aprovar → enviar). Redireciona para lá.
 */
export default async function HealthAgentPage({ params }: Props) {
  const { id } = await params;
  redirect(`/patients/${id}/insights`);
}
