import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AiInsightOutput, NeuroIdentificacao, NeuroSecaoItem } from "@/lib/types";
import type { PatientIdentificacao } from "@/lib/patient-demographics";

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

function Identificacao({ id, live, fallbackName }: { id?: NeuroIdentificacao; live?: PatientIdentificacao; fallbackName?: string | null }) {
  const t = useTranslations("neuroId.documents360.id");
  // Demografia: o CADASTRO ao vivo (live) tem prioridade; o snapshot da IA é fallback.
  // Quando ao vivo e sem data de nascimento, Idade vira "—" (em vez de "0 ano"/sumir).
  const paciente = live?.paciente ?? id?.paciente ?? fallbackName ?? undefined;
  const idade = live ? (live.idade ?? "—") : id?.idade;
  const sexo = live?.sexo ?? id?.sexo;
  const peso = live?.peso ?? id?.peso;
  const altura = live?.altura ?? id?.altura;
  const local = live?.local ?? id?.local;
  // [rótulo, valor, sempreMostrar]
  const rows: Array<[string, string | undefined, boolean]> = [
    [t("patient"), paciente ?? undefined, !!live],
    [t("age"), idade ?? undefined, !!live],
    [t("sex"), sexo, false],
    [t("weight"), peso, false],
    [t("height"), altura, false],
    [t("location"), local, false],
    [t("assessmentDates"), id?.data_avaliacoes, false],
    [t("microphysiotherapy"), id?.microfisioterapia, false],
    [t("hairTest"), id?.exame_cabelo, false],
    [t("guidanceBasis"), id?.base_orientacao, false],
  ];
  const filled = rows.filter(([, v, always]) => always || (v && v.trim()));
  if (filled.length === 0) return null;
  return (
    <div className="mb-3 rounded-xl bg-[#F7F6F2] border border-black/[.05] px-3 py-2">
      {filled.map(([k, v]) => (
        <p key={k} className="text-[12px] leading-5 text-[#0F1A2E]">
          <span className="font-semibold">{k}: </span>
          <span className="text-[#4b5563]">{v && v.trim() ? v : "—"}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Renderiza os documentos do Neuro ID 360 no padrão dos relatórios oficiais.
 * Componente apenas de apresentação (server-compatible). Faz fallback p/ campos antigos.
 */
export function NeuroId360Documents({ output, patientName, liveId }: { output: AiInsightOutput; patientName?: string | null; liveId?: PatientIdentificacao }) {
  const t = useTranslations("neuroId.documents360");
  const mapa = output.mapa_integrativo;
  const plano = output.plano_regulacao;
  const sup = output.protocolo_suplementacao;

  if (!mapa && !plano && !sup) return null;

  return (
    <div className="space-y-3">
      {mapa && (
        <details className="group rounded-2xl border border-black/[.08] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
            <span>
              <span className="block text-[10px] font-semibold tracking-[.10em] uppercase text-[#0F6E56] mb-0.5">{t("doc1Label")}</span>
              <span className="block text-[15px] font-semibold text-[#0F1A2E]">{t("doc1Title")}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#A09E98] transition group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5">
          <Identificacao id={mapa.identificacao} live={liveId} fallbackName={patientName} />
          <Paragraph title={t("examsReviewed")} text={mapa.exames_avaliados ?? mapa.leitura_integrativa} />
          {mapa.resultados_encontrados && mapa.resultados_encontrados.length > 0 ? (
            <LeadItems title={t("resultsFound")} items={mapa.resultados_encontrados} />
          ) : (
            <>
              <Section title={t("mainFindings")} items={mapa.principais_achados} />
              <Section title={t("observedPatterns")} items={mapa.padroes_observados} />
              <Section title={t("functionalFindings")} items={mapa.achados_funcionais} />
              <Section title={t("snaDysregulation")} items={mapa.desregulacao_sna} />
            </>
          )}
          <Paragraph title={t("clinicalSynthesis")} text={mapa.sintese_clinico_funcional} />
          <Paragraph title={t("functionalConclusion")} text={mapa.conclusao_funcional} />
          {mapa.fase_jornada && <Paragraph title={t("journeyPhase")} text={mapa.fase_jornada} />}
          </div>
        </details>
      )}

      {plano && (
        <details className="group rounded-2xl border border-black/[.08] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
            <span>
              <span className="block text-[10px] font-semibold tracking-[.10em] uppercase text-[#0F6E56] mb-0.5">{t("doc2Label")}</span>
              <span className="block text-[15px] font-semibold text-[#0F1A2E]">{t("doc2Title")}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#A09E98] transition group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5">
          <Identificacao id={plano.identificacao} live={liveId} fallbackName={patientName} />
          {(plano.fase_jornada_nome || plano.fase_jornada_justificativa) && (
            <Paragraph
              title={t("journeyPhase")}
              text={[plano.fase_jornada_nome, plano.fase_jornada_justificativa].filter(Boolean).join(" — ")}
            />
          )}
          <Paragraph title={t("therapeuticDirection")} text={plano.direcao_terapeutica} />
          {plano.plano_inicial && plano.plano_inicial.length > 0 ? (
            <LeadItems title={t("initialPlan")} items={plano.plano_inicial} numbered />
          ) : (
            <>
              <Section title={t("nextSteps")} items={plano.proximos_passos} />
              <Section title={t("initialGuidance")} items={plano.orientacoes_iniciais} />
              <Section title={t("routineRecommendations")} items={plano.recomendacoes_rotina} />
            </>
          )}
          <Paragraph title={t("evolutionFollowUp")} text={plano.acompanhamento_evolucao} />
          <Paragraph title={t("nextStep")} text={plano.proximo_passo} />
          </div>
        </details>
      )}

      {sup && (sup.itens.length > 0 || sup.observacoes_gerais.length > 0) && (
        <details className="group rounded-2xl border border-[#D9A441]/40 bg-[#FDF8EE]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
            <span>
              <span className="block text-[10px] font-semibold tracking-[.10em] uppercase text-[#8A5A06] mb-0.5">{t("doc3Label")}</span>
              <span className="block text-[15px] font-semibold text-[#0F1A2E]">{t("doc3Title")}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#A09E98] transition group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5">
          {sup.itens.length > 0 && (
            <div className="space-y-2 mb-3">
              {sup.itens.map((it, i) => (
                <div key={i} className="rounded-xl bg-white border border-black/[.06] px-3 py-2">
                  <p className="text-[13px] font-semibold text-[#0F1A2E]">{it.nome}</p>
                  {it.dose_sugerida && <p className="text-[12px] text-[#6B6A66]">{t("suggestedDose")}: {it.dose_sugerida}</p>}
                  {it.objetivo && <p className="text-[12px] text-[#6B6A66]">{t("objective")}: {it.objetivo}</p>}
                  {it.observacao && <p className="text-[12px] text-[#6B6A66]">{t("note")}: {it.observacao}</p>}
                </div>
              ))}
            </div>
          )}
          <Section title={t("generalNotes")} items={sup.observacoes_gerais} />
          </div>
        </details>
      )}
    </div>
  );
}
