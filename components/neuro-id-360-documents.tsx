import type { AiInsightOutput, NeuroIdentificacao, NeuroSecaoItem } from "@/lib/types";

function Section({ title, items }: { title: string; items?: string[] }) {
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
      <p className="text-[13px] leading-5 text-[#0F1A2E] text-justify">{text}</p>
    </div>
  );
}

function LeadItems({ title, items, numbered }: { title: string; items?: NeuroSecaoItem[]; numbered?: boolean }) {
  const arr = (items ?? []).filter((it) => it.titulo || it.descricao);
  if (arr.length === 0) return null;
  return (
    <div className="mb-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6A66] mb-1">{title}</p>
      <div className="space-y-2">
        {arr.map((it, i) => (
          <p key={i} className="text-[13px] leading-5 text-[#0F1A2E] text-justify">
            <span className="font-semibold">{numbered ? `${i + 1}. ` : ""}{it.titulo}</span>
            {it.descricao ? <span className="text-[#4b5563]"> — {it.descricao}</span> : null}
          </p>
        ))}
      </div>
    </div>
  );
}

function Identificacao({ id, fallbackName }: { id?: NeuroIdentificacao; fallbackName?: string | null }) {
  const rows: Array<[string, string | undefined]> = [
    ["Paciente", id?.paciente ?? fallbackName ?? undefined],
    ["Idade", id?.idade],
    ["Sexo", id?.sexo],
    ["Peso", id?.peso],
    ["Altura", id?.altura],
    ["Local", id?.local],
    ["Data das avaliações", id?.data_avaliacoes],
    ["Microfisioterapia", id?.microfisioterapia],
    ["Exame de cabelo", id?.exame_cabelo],
    ["Base da orientação", id?.base_orientacao],
  ];
  const filled = rows.filter(([, v]) => v && v.trim());
  if (filled.length === 0) return null;
  return (
    <div className="mb-3 rounded-xl bg-[#F7F6F2] border border-black/[.05] px-3 py-2">
      {filled.map(([k, v]) => (
        <p key={k} className="text-[12px] leading-5 text-[#0F1A2E]">
          <span className="font-semibold">{k}: </span>
          <span className="text-[#4b5563]">{v}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Renderiza os documentos do Neuro ID 360 no padrão dos relatórios oficiais.
 * Componente apenas de apresentação (server-compatible). Faz fallback p/ campos antigos.
 */
export function NeuroId360Documents({ output, patientName }: { output: AiInsightOutput; patientName?: string | null }) {
  const mapa = output.mapa_integrativo;
  const plano = output.plano_regulacao;
  const sup = output.protocolo_suplementacao;

  if (!mapa && !plano && !sup) return null;

  return (
    <div className="space-y-3">
      {mapa && (
        <div className="rounded-2xl border border-black/[.08] bg-white p-5">
          <p className="text-[10px] font-semibold tracking-[.10em] uppercase text-[#0F6E56] mb-1">Documento 1</p>
          <h3 className="text-[15px] font-semibold text-[#0F1A2E] mb-3">Relatório Funcional Integrado — Neuro ID</h3>
          <Identificacao id={mapa.identificacao} fallbackName={patientName} />
          <Paragraph title="Exames e informações avaliadas" text={mapa.exames_avaliados ?? mapa.leitura_integrativa} />
          {mapa.resultados_encontrados && mapa.resultados_encontrados.length > 0 ? (
            <LeadItems title="Resultados encontrados" items={mapa.resultados_encontrados} />
          ) : (
            <>
              <Section title="Principais achados" items={mapa.principais_achados} />
              <Section title="Padrões observados" items={mapa.padroes_observados} />
              <Section title="Achados funcionais" items={mapa.achados_funcionais} />
              <Section title="Desregulação do sistema nervoso (SNA)" items={mapa.desregulacao_sna} />
            </>
          )}
          <Paragraph title="Síntese clínico-funcional" text={mapa.sintese_clinico_funcional} />
          <Paragraph title="Conclusão funcional" text={mapa.conclusao_funcional} />
          {mapa.fase_jornada && <Paragraph title="Fase na Jornada Neuro ID" text={mapa.fase_jornada} />}
        </div>
      )}

      {plano && (
        <div className="rounded-2xl border border-black/[.08] bg-white p-5">
          <p className="text-[10px] font-semibold tracking-[.10em] uppercase text-[#0F6E56] mb-1">Documento 2</p>
          <h3 className="text-[15px] font-semibold text-[#0F1A2E] mb-3">Plano Integrativo Neuro ID</h3>
          <Identificacao id={plano.identificacao} fallbackName={patientName} />
          {(plano.fase_jornada_nome || plano.fase_jornada_justificativa) && (
            <Paragraph
              title="Fase na Jornada Neuro ID"
              text={[plano.fase_jornada_nome, plano.fase_jornada_justificativa].filter(Boolean).join(" — ")}
            />
          )}
          <Paragraph title="Direção terapêutica" text={plano.direcao_terapeutica} />
          {plano.plano_inicial && plano.plano_inicial.length > 0 ? (
            <LeadItems title="Plano integrativo inicial" items={plano.plano_inicial} numbered />
          ) : (
            <>
              <Section title="Próximos passos" items={plano.proximos_passos} />
              <Section title="Orientações iniciais" items={plano.orientacoes_iniciais} />
              <Section title="Recomendações de rotina" items={plano.recomendacoes_rotina} />
            </>
          )}
          <Paragraph title="Acompanhamento da evolução" text={plano.acompanhamento_evolucao} />
          <Paragraph title="Próximo passo" text={plano.proximo_passo} />
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
