/**
 * Legendas de exames funcionais (Neuro ID) — blocos de instrução para a IA de extração.
 *
 * Destilados dos manuais/relatórios canônicos (NeuroSense / MARS III) para que a IA
 * leia cada exame com a MESMA legenda clínica que a clínica usa, em vez de interpretar
 * livremente. Objetivo: leitura VERDADEIRA e VERIFICÁVEL — toda afirmação ancorada em
 * valor medido + faixa de referência, sem invenção e sem linguagem esotérica.
 *
 * Decisões de Marcelo (2026-06-21):
 *  - Relatório FUNCIONAL e CIENTÍFICO: nada esotérico/holístico (sem chakra, aura,
 *    afirmação Louise Hay, "energia/vibração/cura").
 *  - Biorressonância: nomear as MAIORES emoções reais do exame e relacioná-las a
 *    órgãos (coração/pulmão/rim…), abrindo com "De acordo com a análise do exame,
 *    foi encontrado um perfil de…".
 *  - Tom prudente: "o exame sugere / registra / aponta", nunca diagnóstico fechado.
 *
 * Mapa de origem completo (com campos `precisa_manual`):
 *   ../../legendas_exames/legenda_neurometria.json
 *   ../../legendas_exames/legenda_biorressonancia.json (fora do repo, no diretório do projeto)
 */

const NEUROMETRIA_LEGEND = `
LEGENDA DA NEUROMETRIA (NeuroSense — Exame de DLO do SNA). O exame tem 6 dimensões fixas.
Extraia, quando presentes, os valores reais de cada uma e traduza pela legenda:

1) Controle de ansiedade e resposta emocional (eixo HPA/adrenal): mín/máx/média/desvio/CV (%).
   Média alta com "reserva no limite mínimo" = controle preservado mas margem reduzida
   (maior sensibilidade ao estresse, cansaço mental).
2) Função cardíaca e variabilidade — HRV (eixo SNA/cardio-cerebral): bpm mín/máx/média.
   HRV comprometida + eixo cardio-cerebral alto = sobrecarga neurovegetativa ligada a
   ansiedade, tensão e sono.
3) Fluxo sanguíneo, hemodinâmica e oxigênio (circulação/inflamação): índice barorreflexo (%)
   e resposta hemodinâmica (%). Barorreflexo alto = ótima resposta reflexa (ponto POSITIVO);
   fluxo moderado = atenção ao transporte de nutrientes/oxigênio.
4) Temperatura periférica (tônus simpático/termorregulação): média em °C.
   FAIXA DE REFERÊNCIA FIXA = 31,5 a 32,5 °C. Abaixo disso = vasoconstrição/maior alerta,
   ligada a dificuldade de relaxar e extremidades frias.
5) Sistema nervoso autônomo — Tilt Test (núcleo do método): amplitude e frequência
   simpático/parassimpático (%). Simpático dominante + parassimpático baixo = corpo mais
   pronto para reagir do que para descansar/recuperar.
6) Análise das vias nervosas (síntese): capacidade adaptativa (%), inflamação subclínica,
   índice do eixo cérebro-intestino (%). Reforça o padrão global de sobrecarga + adaptação.

REGRAS DE LEITURA:
- Agrupe as dimensões que contam a MESMA história em achados únicos (ex.: predomínio simpático
  + HRV comprometida + temperatura baixa = um achado de "sistema nervoso em alerta, recuperação
  reduzida"). Não liste dimensão por dimensão crua.
- Sempre que possível, cite o valor medido junto (ex.: "temperatura média 28,8 °C; faixa 31,5–32,5").
- Destaque pelo menos 1 PONTO POSITIVO (ex.: barorreflexo ótimo) — gera confiança no cuidado.
`.trim();

const BIORRESSONANCIA_LEGEND = `
LEGENDA DA BIORRESSONÂNCIA (teste bioenergético MARS III). Escala: % (0–30 natural /
30–70 carga aumentada / 70–100 excesso) e OF/UF +/- (0–3 / 3–7 / 7–10). Itens com
|valor| 7–10 (ou % 70–100) são os de carga relevante.

O QUE EXTRAIR (apenas a leitura emocional FUNCIONAL):
- Foque na categoria de Psicologia/Emoções. Pegue as EMOÇÕES DE MAIOR VALOR (as mais
  alteradas) e nomeie-as de verdade (ex.: medo, ansiedade, tristeza, tensão/raiva,
  sensação de separação/abandono, dificuldade de vínculo/pertencimento/segurança,
  amor não correspondido, vergonha).
- Relacione as emoções aos ÓRGÃOS, como o exame faz (leitura psicossomática, uso
  FUNCIONAL e não místico):
    • Coração — alegria/afeto, amor não correspondido, desilusão, choque emocional
    • Pulmão — tristeza, luto, dificuldade de soltar, perfeccionismo
    • Rim / bexiga — medo, insegurança, falta de direção, vergonha
    • Estômago / baço-pâncreas — preocupação, autoestima, acolhimento
    • Fígado / vesícula — raiva, frustração, indecisão
- Abra a síntese com: "De acordo com a análise do exame, foi encontrado um perfil de …".
- Feche conectando ao sistema nervoso: esse perfil emocional acumulado PODE manter o
  sistema nervoso em alerta, dificultar o sono e reduzir a recuperação (conversa com a
  neurometria, se houver).

PROIBIDO (fronteira fé/clínica — decisão de Marcelo):
- NÃO usar conteúdo esotérico/holístico: nada de chakra, aura, cromoterapia, afirmações
  (Louise Hay/Cathrine Ponder), "energia/vibração/cura vibracional". A categoria de
  "Wisdom teachings / Infinite Wisdom" é EXCLUÍDA do relatório.
- NÃO diagnosticar nem afirmar mecanismo provado: usar "o exame associou / sugere /
  pode estar relacionado".
`.trim();

/** Bloco de legenda específico do tipo de exame, para anexar ao system prompt. */
export function examLegendBlock(examType: string): string {
  if (examType === "neurometria") return NEUROMETRIA_LEGEND;
  if (examType === "biorressonancia") return BIORRESSONANCIA_LEGEND;
  return "";
}
