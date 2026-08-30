import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AiInsightOutput, NeuroIdentificacao, NeuroLeituraBioemocional, NeuroSecaoItem } from "@/lib/types";
import type { PatientIdentificacao } from "@/lib/patient-demographics";
import { hasPersuasiveDoc1, hasPersuasiveDoc2 } from "@/modules/ai-insights/patient-text-guardrails";

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

const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-[#6B6A66] mb-1";
const SUBHEAD_CLASS = "text-[13px] font-semibold text-[#0F6E56] mb-1";

/** Cabeçalho numerado de seção do relatório fundido (1..6): número em destaque + régua fina. */
function SectionHead({ n, title }: { n: string; title: string }) {
  return (
    <div className="mt-4 mb-2 border-b border-black/[.08] pb-1">
      <p className="text-[14px] font-semibold text-[#0F1A2E]">
        <span className="text-[#0F6E56]">{n}.</span> {title}
      </p>
    </div>
  );
}

/** Parágrafo do corpo, justificado, sem rótulo (fluxo contínuo do relatório). */
function BodyP({ text }: { text?: string | null }) {
  if (!text || !text.trim()) return null;
  return <p className="mb-2 text-[13px] leading-6 text-[#0F1A2E] text-justify">{text}</p>;
}

/** Documento 1 na Rota A persuasiva: leituras achado→significado (sem travessão). */
function Readings({ title, items }: { title: string; items?: NeuroSecaoItem[] }) {
  const arr = (items ?? []).filter((it) => it.titulo || it.descricao);
  if (arr.length === 0) return null;
  return (
    <div className="mb-3">
      <p className={SUBHEAD_CLASS}>{title}</p>
      <div className="space-y-2">
        {arr.map((it, i) => (
          <div key={i}>
            {it.titulo ? <p className="text-[13px] font-semibold text-[#0F1A2E]">{it.titulo}</p> : null}
            {it.descricao ? <p className="text-[13px] leading-5 text-[#4b5563] text-justify">{it.descricao}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Slot bioemocional dedicado: temas (chips) + síntese qualitativa. */
function EmotionalReading({ title, data }: { title: string; data?: NeuroLeituraBioemocional }) {
  if (!data || ((data.temas ?? []).length === 0 && !data.sintese?.trim())) return null;
  return (
    <div className="mb-3">
      <p className={SUBHEAD_CLASS}>{title}</p>
      {(data.temas ?? []).length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {data.temas.map((tema, i) => (
            <span key={i} className="rounded-full bg-[#0F1A2E]/[.05] text-[#0F1A2E] text-[12px] px-2.5 py-0.5">
              {tema}
            </span>
          ))}
        </div>
      ) : null}
      {data.sintese?.trim() ? <p className="text-[13px] leading-5 text-[#0F1A2E] text-justify">{data.sintese}</p> : null}
    </div>
  );
}

/** Âncora positiva obrigatória: destaque verde, o ponto forte a favor do paciente. */
function AnchorHighlight({ title, text }: { title: string; text?: string | null }) {
  if (!text || !text.trim()) return null;
  return (
    <div className="mb-3 rounded-xl bg-[#0F6E56]/[.06] border border-[#0F6E56]/20 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0F6E56] mb-1">{title}</p>
      <p className="text-[13px] leading-5 text-[#0F1A2E]">{text}</p>
    </div>
  );
}

/** Um dos três pilares do Doc 2: rótulo humano + frase. */
function PillarItem({ label, text }: { label: string; text?: string | null }) {
  if (!text || !text.trim()) return null;
  return (
    <div>
      <p className="text-[13px] font-semibold text-[#0F1A2E]">{label}</p>
      <p className="text-[13px] leading-5 text-[#4b5563] text-justify">{text}</p>
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

  // FUSÃO Doc 1 + Doc 2: quando os dois estão no formato persuasivo, o plano é o
  // FECHO ("próximos passos") do MESMO relatório, não um documento separado. O
  // card do plano só aparece à parte no formato legado.
  const fused = !!mapa && hasPersuasiveDoc1(mapa) && !!plano && hasPersuasiveDoc2(plano);

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
          {hasPersuasiveDoc1(mapa) ? (
            <>
              {/* 1 */}
              <SectionHead n="1" title={t("greetingTitle")} />
              <BodyP text={mapa.abertura_calorosa} />
              {/* 2 */}
              <SectionHead n="2" title={t("clinicalPictureTitle")} />
              <BodyP text={mapa.leitura_bio3?.descricao} />
              {/* 3 — neurometria e biorressonância em subseções SEPARADAS e condicionais */}
              <SectionHead n="3" title={t("whatWeFoundTitle")} />
              <Readings title={`3.1  ${t("neurometricReading")}`} items={mapa.leitura_neurometrica} />
              <EmotionalReading title={`3.2  ${t("emotionalReading")}`} data={mapa.leitura_bioemocional} />
              {/* 4 */}
              <SectionHead n="4" title={t("connectionTitle")} />
              <BodyP text={mapa.conexao_aha} />
              <AnchorHighlight title={t("positiveAnchor")} text={mapa.ancora_positiva} />
              {/* 5 */}
              <SectionHead n="5" title={t("whyActNow")} />
              <BodyP text={mapa.porque_agir_agora} />
              {/* 6 — o plano é o fecho do mesmo relatório */}
              <SectionHead n="6" title={t("nextStepsTitle")} />
              {fused && plano ? (
                <>
                  <BodyP text={plano.onde_queremos_chegar} />
                  {plano.tres_pilares ? (
                    <div className="mb-3">
                      <p className={SUBHEAD_CLASS}>{t("pillarsTitle")}</p>
                      <div className="space-y-2">
                        <PillarItem label={t("pillarNervous")} text={plano.tres_pilares.nervoso} />
                        <PillarItem label={t("pillarEmotional")} text={plano.tres_pilares.emocional} />
                        <PillarItem label={t("pillarLifestyle")} text={plano.tres_pilares.estilo_de_vida} />
                      </div>
                    </div>
                  ) : null}
                  <BodyP text={plano.como_caminhar_juntos} />
                  <BodyP text={plano.proximo_passo ?? mapa.proximo_passo} />
                </>
              ) : (
                <BodyP text={mapa.proximo_passo} />
              )}
              {((fused ? plano?.observacao : null) ?? mapa.observacao) ? (
                <p className="mt-3 text-[11px] leading-4 text-[#A09E98]">{(fused ? plano?.observacao : null) ?? mapa.observacao}</p>
              ) : null}
            </>
          ) : (
            <>
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
            </>
          )}
          </div>
        </details>
      )}

      {plano && !fused && (
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
          {hasPersuasiveDoc2(plano) ? (
            <>
              <Paragraph title={t("goalTitle")} text={plano.onde_queremos_chegar} />
              {plano.tres_pilares ? (
                <div className="mb-3">
                  <p className={LABEL_CLASS}>{t("pillarsTitle")}</p>
                  <div className="space-y-2">
                    <PillarItem label={t("pillarNervous")} text={plano.tres_pilares.nervoso} />
                    <PillarItem label={t("pillarEmotional")} text={plano.tres_pilares.emocional} />
                    <PillarItem label={t("pillarLifestyle")} text={plano.tres_pilares.estilo_de_vida} />
                  </div>
                </div>
              ) : null}
              <Paragraph title={t("howWeWalk")} text={plano.como_caminhar_juntos} />
              <Paragraph title={t("nextStep")} text={plano.proximo_passo} />
              {plano.observacao ? (
                <p className="mt-3 text-[11px] leading-4 text-[#A09E98]">{plano.observacao}</p>
              ) : null}
            </>
          ) : (
            <>
              {(plano.fase_jornada_nome || plano.fase_jornada_justificativa) && (
                <Paragraph
                  title={t("journeyPhase")}
                  text={[plano.fase_jornada_nome, plano.fase_jornada_justificativa].filter(Boolean).join(" · ")}
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
            </>
          )}
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
