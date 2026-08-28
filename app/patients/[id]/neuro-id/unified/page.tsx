import UnifiedFormClient from "./unified-form-client";

/**
 * Rota INTERNA / TESTE do formulário unificado Neuro ID. Renderiza a tela e, ao
 * concluir, grava o Mapa Bio³ do paciente (rascunho). Não é o envio a paciente
 * (isso depende do seed com placement + travas de compliance).
 */
export default async function UnifiedFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="p-2">
      <h1 className="mb-1 px-2 text-xl font-semibold">Formulário Neuro ID — Perfil de 30 Dias</h1>
      <p className="mb-3 px-2 text-sm text-neutral-500">Uso interno / teste. Ao concluir, grava o Mapa Bio³ deste paciente como rascunho.</p>
      <UnifiedFormClient patientId={id} />
    </div>
  );
}
