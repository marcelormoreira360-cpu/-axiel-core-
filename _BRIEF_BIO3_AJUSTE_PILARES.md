# BRIEF — Ajuste do Mapa Bio³: mapeamento correto + segmentação QRM/Q-SNA por IA

> Correção clínica do mapeamento item→pilar (o build inicial errou) + nova capacidade: IA segmenta QRM e Q-SNA e roteia os sub-scores pro pilar certo. Depois o motor determinístico calcula.
> Ajusta `modules/neuro-id/catalog.ts`, `scoring.ts`, o form de entrada e os testes. Ler `CONTEXT.md` antes. `/code-review --fix` no fim.

## 1. Conceito-chave (o que muda)
- **Todo item de mobilidade/palpação é BIOMECÂNICO** (mesmo os que tocam ramos do SNA — é teste manual do terapeuta). Não jogar mobilidade no Bioemocional.
- **QRM e Q-SNA são instrumentos SEGMENTADOS:** o mesmo exame tem sub-scores que vão pra pilares diferentes. A IA extrai e roteia; o motor calcula.
- **Escala unificada (decisão Marcelo 2026-06-18): TUDO é 0–10 onde MAIOR = mais disfunção (`higher_worse`).** Some o "↑melhor/↑pior" misto (era a causa dos bugs de direção). Com 3 faixas qualitativas por tipo de item:
  - Mobilidade/palpação: **0–3 solto · 4–6 tenso · 7–10 bloqueado**
  - Dor: 0–3 leve · 4–6 moderada · 7–10 intensa
  - QRM / Q-SNA / sintomas: 0–3 baixo · 4–6 moderado · 7–10 alto
  - **Input numérico 0–10** (precisão do cálculo) **+ faixa exibida como rótulo/cor** na tela e no relatório. (Opcional: modo "só faixa" como toggle.)
  - `disfuncao = valor × 10` (não há mais inversão `10−valor`).

## 2. Mapeamento corrigido (catalog.ts — substituir)
### Biomecânico — TODOS `higher_worse` (escala restrição solto/tenso/bloqueado, exceto onde indicado)
| code | label | faixa |
|---|---|---|
| dor | Dor | leve/moderada/intensa |
| restr_sacroiliaca | Sacro-ilíaca | solto/tenso/bloqueado |
| restr_capsula_quadril | Cápsula do quadril | solto/tenso/bloqueado |
| restr_lombar | Lombar | solto/tenso/bloqueado |
| restr_tronco_simpatico | Tronco simpático | solto/tenso/bloqueado |
| restr_visceral_diafragma | Visceral + diafragma | solto/tenso/bloqueado |
| restr_clavicular_plexo | Infra/supra clavicular + plexo cardíaco/pulmonar | solto/tenso/bloqueado |
| restr_vago_ganglio | Vago + gânglio cervical | solto/tenso/bloqueado |
| restr_vago_orelha_temporal | Vago orelha + temporal | solto/tenso/bloqueado |
| restr_occipto_mastoide | Sutura occipto-mastoide / cervical alta | solto/tenso/bloqueado |
| qrm_musculo_articular | QRM — segmento articulações/músculos | baixo/moderado/alto |

### Bioquímico
| code | label | direção |
|---|---|---|
| intestino | Intestino | higher_worse |
| ciclo_hormonal | Ciclo / hormonal | higher_worse |
| medicacao_carga | Medicação (carga) | higher_worse |
| exame_sangue | Exames de sangue (quando tiver) | regra por marcador (lab) |
| exame_cabelo | Exame de cabelo (quando tiver) | regra (lab) |
| qrm_total | QRM total | higher_worse |
| qsna_total | Q-SNA total | higher_worse (peso menor — ver §4 overlap) |

### Bioemocional
| code | label | direção |
|---|---|---|
| qrm_coracao | QRM — coração | higher_worse |
| qrm_pulmao | QRM — pulmão | higher_worse |
| qrm_trato_digestivo | QRM — trato digestivo | higher_worse |
| qrm_mente | QRM — mente | higher_worse |
| qrm_emocoes | QRM — emoções | higher_worse |
| biorressonancia_emocional | Biorressonância emocional (quando tiver) | regra |
| qsna_sono | Q-SNA — Sono / Ritmos Biológicos | higher_worse |
| qsna_emocional | Q-SNA — Emocional / Psicossocial | higher_worse |
| qsna_gi_visceral | Q-SNA — Gastrointestinal / Visceral | higher_worse |
| qsna_neurocognitiva | Q-SNA — Neurocognitiva / Executiva | higher_worse |

## 3. IA segmentadora (parser → estrutura → revisão → motor)
Adicionar um serviço (ex.: `modules/neuro-id/segment-instruments.ts` + action) que:
1. recebe o **QRM completo** e o **Q-SNA completo** (texto colado ou upload);
2. usa a IA SÓ pra **extrair sub-scores** e mapeá-los aos `code`s acima:
   - QRM → `qrm_musculo_articular` (biomecânico), `qrm_total` (bioquímico), `qrm_coracao/pulmao/trato_digestivo/mente/emocoes` (bioemocional);
   - Q-SNA → `qsna_total` (bioquímico), `qsna_sono/emocional/gi_visceral/neurocognitiva` (bioemocional);
3. devolve um **rascunho estruturado** (valores 0–10/escala) pro terapeuta **revisar e editar** na tela;
4. ao confirmar, grava em `patient_assessment_values` e o **motor determinístico** (`scoring.ts`) calcula.
> Guarda-corpo: a IA NÃO inventa %. Só extrai número de um documento; humano revisa; a conta é matemática. Se não conseguir extrair um item → fica `partial` (CTA), não chuta.

## 4. Overlap Q-SNA (CONFIRMADO por Marcelo 2026-06-18)
`qsna_total` (Bioquímico) já contém os domínios (Bioemocional). Decisão: manter ambos, mas `qsna_total` com **peso menor** (default 0.5) = marcador geral de carga autonômica. Peso ajustável por clínica.

## 5. Form de entrada (corrigir)
- Mover todos os itens de mobilidade pro grupo **Biomecânico**; corrigir os rótulos de direção (mobilidade = ↑ melhor).
- Bioquímico e Bioemocional passam a ter os campos de **sub-score de QRM/Q-SNA** (ou o fluxo "colar QRM/Q-SNA → IA preenche → revisar").
- Manter "deixar em branco = dado pendente (CTA)".

## 6. Aceite
- [ ] catalog.ts com o mapeamento e direções da §2; testes de scoring atualizados e verdes.
- [ ] motor calcula com QRM/Q-SNA segmentados; overlap do Q-SNA tratado (§4).
- [ ] IA extrai sub-scores de um QRM e de um Q-SNA reais e roteia certo; humano revisa antes de calcular.
- [ ] form reflete os 3 grupos corrigidos.
- [ ] `/code-review --fix` limpo.

## 7. Kickoff (cole na sessão do repo do Core)
> "Leia CONTEXT.md, este _BRIEF_BIO3_AJUSTE_PILARES.md e o _BRIEF_BIO3_VISUAL.md. FASE 1 (determinística, faça primeiro): aplique a ESCALA UNIFICADA (§1 — tudo 0–10 higher_worse; faixas solto/tenso/bloqueado p/ mobilidade, leve/mod/intensa p/ dor, baixo/mod/alto p/ resto; input numérico + faixa como rótulo/cor); corrija `modules/neuro-id/catalog.ts` com o mapeamento da §2; aplique o sistema de cores semáforo do _BRIEF_BIO3_VISUAL.md (util bandFor(), cor+rótulo+ícone na pirâmide, índice, chips e PDF — acessível); ajuste o form de entrada (§5, mostrando a faixa) e atualize os testes de scoring — rode e deixe verde. FASE 2: implemente a IA segmentadora da §3 (parser de QRM e Q-SNA → sub-scores estruturados → revisão humana → motor calcula), com o overlap do Q-SNA da §4 (qsna_total peso 0.5). Não invente %; IA só extrai, humano revisa. Pergunte só em decisão ambígua. Ao fim, /code-review --fix e me mostre o que mudou. Não faça deploy sem meu OK."
