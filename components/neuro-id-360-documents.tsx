import type { AiInsightOutput } from "@/lib/types";

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6A66] mb-1">{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-[13px] leading-5 text-[#0F1A2E] pl-3 relative">
            <span className="absolute left-0 text-[#0F6E56]">•</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Paragraph({ title, text }: { title: string; text?: string | null }) {
  if (!text || !text.trim()) return null;
  return (
    <div className="mb-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6A66] mb-1">{title}</p>
      <p className="text-[13px] leading-5 text-[#0F1A2E]">{text}</p>
    </div>
  );
}

/**
 * Renderiza os 3 documentos do Neuro ID 360 quando presentes no output da IA.
 * Componente apenas de apresentação (server-compatible).
 */
export function NeuroId360Documents({ output }: { output: AiInsightOutput }) {
  const mapa = output.mapa_integrativo;
  const plano = output.plano_regulacao;
  const sup = output.protocolo_suplementacao;

  if (!mapa && !plano && !sup) return null;

  return (
    <div className="space-y-3">
      {mapa && (
        <div className="rounded-2xl border border-black/[.08] bg-white p-5">
          <p className="text-[10px] font-semibold tracking-[.10em] uppercase text-[#0F6E56] mb-1">Documento 1</p>
          <h3 className="text-[15px] font-semibold text-[#0F1A2E] mb-3">Mapa Integrativo Neuro ID 360</h3>
          <Section title="Principais achados" items={mapa.principais_achados} />
          <Section title="Padrões observados" items={mapa.padroes_observados} />
          <Paragraph title="Leitura integrativa" text={mapa.leitura_integrativa} />
          <Section title="Achados funcionais" items={mapa.achados_funcionais} />
          <Section title="Elementos biomecânicos" items={mapa.elementos_biomecanicos} />
          <Section title="Elementos bioemocionais" items={mapa.elementos_bioemocionais} />
          <Section title="Desregulação do sistema nervoso (SNA)" items={mapa.desregulacao_sna} />
          <Section title="Possíveis fatores bioquímicos" items={mapa.fatores_bioquimicos} />
          <Section title="Prioridades de atenção" items={mapa.prioridades_atencao} />
        </div>
      )}

      {plano && (
        <div className="rounded-2xl border border-black/[.08] bg-white p-5">
          <p className="text-[10px] font-semibold tracking-[.10em] uppercase text-[#0F6E56] mb-1">Documento 2</p>
          <h3 className="text-[15px] font-semibold text-[#0F1A2E] mb-3">Plano Inicial de Regulação</h3>
          <Section title="Próximos passos" items={plano.proximos_passos} />
          <Section title="Orientações iniciais" items={plano.orientacoes_iniciais} />
          <Section title="Recomendações de rotina" items={plano.recomendacoes_rotina} />
          <Section title="Sugestões de regulação" items={plano.sugestoes_regulacao} />
          <Section title="Exames complementares recomendados" items={plano.exames_complementares} />
          <Section title="Prioridades" items={plano.prioridades} />
          <Paragraph title="Recomendação de continuidade" text={plano.recomendacao_continuidade} />
        </div>
      )}

      {sup && (sup.itens.length > 0 || sup.observacoes_gerais.length > 0) && (
        <div className="rounded-2xl border border-[#D9A441]/40 bg-[#FDF8EE] p-5">
          <p className="text-[10px] font-semibold tracking-[.10em] uppercase text-[#8A5A06] mb-1">Documento 3 · rascunho, exige aprovação</p>
          <h3 className="text-[15px] font-semibold text-[#0F1A2E] mb-3">Protocolo de Suplementação</h3>
          {sup.itens.length > 0 && (
            <div className="space-y-2 mb-3">
              {sup.itens.map((it, i) => (
                <div key={i} className="rounded-xl bg-white border border-black/[.06] px-3 py-2">
                  <p className="text-[13px] font-semibold text-[#0F1A2E]">{it.nome}</p>
                  {it.dose_sugerida && <p className="text-[12px] text-[#6B6A66]">Dose sugerida: {it.dose_sugerida}</p>}
                  {it.objetivo && <p className="text-[12px] text-[#6B6A66]">Objetivo: {it.objetivo}</p>}
                  {it.observacao && <p className="text-[12px] text-[#6B6A66]">Obs.: {it.observacao}</p>}
                </div>
              ))}
            </div>
          )}
          <Section title="Observações gerais" items={sup.observacoes_gerais} />
        </div>
      )}
    </div>
  );
}
