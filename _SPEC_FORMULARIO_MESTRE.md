# Spec — Formulário-Mestre Neuro ID (Bio³)

**Versão:** rascunho 1 · 2026-09-14 · aguardando aprovação de Marcelo
**Objetivo:** um único formulário para o paciente responder, do qual saem os 3 pilares do Mapa Bio³ e, quando fizer sentido clínico, os instrumentos (QRM, Q-SNA, GAD-7, etc.), SEM quebrar a validade de cada instrumento.

---

## 1. Princípio (o que muda de mentalidade)

Hoje o formulário de 30 dias, o QRM e o Q-SNA são **três questionários paralelos**. A dor do Marcelo: o paciente responde um e os outros ficam "não respondido"; perguntas parecidas são feitas 2-3 vezes.

O mestre resolve com **deduplicação por CONCEITO, não por texto**:
- Uma pergunta única (ex.: "dificuldade para dormir") alimenta **vários destinos** (pilar Biofuncional + subdomínio Sono + o que o Q-SNA chamaria de "sono/ritmos").
- **Regra de ouro (validade):** só reutilizo a mesma resposta para um instrumento oficial quando batem **período, escala, respondente e redação**. Quando não batem, o instrumento vira **módulo próprio** (não derivo um número inválido).

Consequência prática: **GAD-7, PHQ-9 e MADRS NÃO são "derivados" do formulário de 30 dias** (períodos/escala/respondente diferentes). Eles ficam como **módulos oficiais separados**, disparados quando você quer o escore validado. O formulário-mestre entrega os **pilares Bio³** e um mapa de subdomínios.

---

## 2. Arquitetura em 3 camadas

```
CAMADA 1 — Formulário-mestre (PACIENTE responde, últimos 30 dias)
   → alimenta os subdomínios → pilares Bio³ (Biomecânico autorrelato, Biofuncional, Bioemocional)

CAMADA 2 — Exame do TERAPEUTA (presencial)
   → completa o Biomecânico (mobilidade, força, palpação, cervical/lombar/quadril/SI)
   → MADRS (se indicado), confirmação de alertas, validação final

CAMADA 3 — Módulos oficiais OPCIONAIS (instrumentos validados, período próprio)
   → GAD-7 (2 semanas), PHQ-9 (2 semanas), MADRS (7 dias, profissional), QRM/Q-SNA completos
   → disparados sob demanda; escore oficial preservado, NUNCA fabricado a partir do mestre
```

O Mapa Bio³ combina Camada 1 + Camada 2. Os módulos da Camada 3 aparecem como escores próprios ao lado (não entram no pilar como "escore oficial", mas seus itens podem alimentar subdomínios se período/escala baterem).

---

## 3. O formulário-mestre (perguntas do paciente)

Blocos com nome leigo (o paciente não vê "QRM"/"Q-SNA"). Uma pergunta por vez, barra de progresso, condicionais só quando necessário. Escala padrão do sintoma = **gravidade 0-4 (`bio3_severity`)**: Ausente / Leve / Moderado / Intenso / Muito intenso, "considerando frequência e impacto nos últimos 30 dias".

> Legenda da coluna **Alimenta**: `Pilar › Subdomínio` + (instrumento que cobre o mesmo conceito, para relatório/comparação).

### Bloco A — Perfil e segurança (não pontua)
Idioma, nascimento, objetivo, gravidez/amamentação, marca-passo/epilepsia, diagnóstico ativo, perda de peso inexplicada (bandeira).

### Bloco B — Corpo e movimento → **Biomecânico (autorrelato)**
| Pergunta | Alimenta |
|---|---|
| Dor no corpo (+ regiões) | Biomecânico › Dor |
| Rigidez / travamento | Biomecânico › Rigidez |
| Limitação em movimentos do dia a dia | Biomecânico › Limitação |
| Desequilíbrio / instabilidade | Biomecânico › Equilíbrio |
| Fraqueza muscular | Biomecânico › Força (percebida) |

> ⚠️ Biomecânico **exige a Camada 2** (exame presencial) para fechar. Até lá = "Parcial · aguardando avaliação profissional" (já implementado).

### Bloco C — Coração, respiração e regulação → **Biofuncional › Cardiovascular/autonômico + Respiratório**
Palpitações, tontura ao levantar, termorregulação/suores, desconforto torácico, falta de ar, respiração curta sob tensão, pressão instável.
> Cobre o conceito de **Q-SNA (ramo simpático/cardiorrespiratório)**. Itens de desconforto torácico / falta de ar / palpitação também disparam **alerta cardiorrespiratório** (fora do score).

### Bloco D — Digestão, metabolismo e corpo todo → **Biofuncional › GI, Endócrino/metabólico, Imune, Pele/cabelo, Urinário/íntimo**
Refluxo/azia/náusea, intestino (prisão/diarreia), inchaço/gases, dor abdominal ligada a estresse, apetite, peso, pele/cabelo/unhas, infecções/recuperação, hormonal/menstrual, e condicionais (olhos, ouvidos, nariz, garganta, urinário, íntimo).
> Cobre o conceito de **QRM (trato digestivo, pele, energia, peso, cabeça/olhos/ouvidos/nariz)** e **Q-SNA GI/visceral**.

### Bloco E — Sono, energia e cognição → **Biofuncional › Sono/ritmos, Energia/recuperação + Bioemocional › Cognição**
Dificuldade de iniciar sono, acordar à noite, sono não reparador, sonolência diurna, fadiga, recuperação lenta, concentração, memória, mente enevoada, ronco/apneia (rastreio 0-3).
> Sono/energia → Biofuncional; concentração/memória/névoa → também Bioemocional › Cognição sob estresse. Cobre **Q-SNA sono/ritmos** e **QRM energia**.

### Bloco F — Como você tem se sentido → **Bioemocional**
- **Humor (escala 0-6 com âncoras):** humor, tensão, sono emocional, apetite emocional, concentração, iniciativa, interesse/prazer, visão de futuro/autocrítica. → Bioemocional › Humor/depressão *(conceito PHQ-9; NÃO é escore PHQ-9 oficial)*.
- **Item de ideação (não pontua):** "vontade de viver/seguir em frente" → **alerta de crise** (988/188), fora do score.
- **Ansiedade/regulação (escala 0-3):** nervosismo, preocupação difícil de controlar, preocupação excessiva, relaxar, inquietação, medo, sobressalto, irritabilidade, hipervigilância, culpa, recuperação pós-estresse. → Bioemocional › Ansiedade, Tensão/hipervigilância, Regulação *(conceito GAD-7; NÃO é escore GAD-7 oficial)*.

### Bloco G — Para completar (opcional) → Camada 3 / exames
Exames de sangue recentes (anexar), mineralograma (cabelo), autoimune, diagnósticos/cirurgias prévios.

### Bloco H — Medicamentos (não pontua no Global) → Índice de Complexidade Medicamentosa
Usa medicamento contínuo, lista, suplementos, efeitos colaterais (0-3), dificuldade de adesão (0-3), mudança recente. → Biofuncional (carga de medicação, peso 0.5) + alerta de interação.

---

## 4. Subdomínios (a normalização que impede diluição)

**Problema real que isto resolve** (visto no dado da paciente): "acordar várias vezes" deu disfunção 100, mas o pilar Biofuncional mostrou 7, porque ~30 itens diluíram o grave.

**Fórmula proposta (nova):**
```
1) disfunção do item = gravidade 0-4 ÷ 4 × 100      (0/25/50/75/100)
2) subdomínio = média dos itens RESPONDIDOS do subdomínio
3) pilar = média dos SUBDOMÍNIOS com dados            (não a média de todos os itens)
4) equilíbrio exibido = 100 − disfunção; índice geral = média dos pilares calculáveis
```
Assim um subdomínio pequeno mas grave (Sono) pesa igual a um subdomínio grande, e o sintoma severo não some. Os "Pontos de atenção" (já implementados) continuam listando os itens graves individualmente.

**Subdomínios por pilar:**
- **Bioemocional:** Ansiedade · Humor/depressão · Tensão/hipervigilância · Interesse/prazer · Regulação · Cognição sob estresse · Sono emocional.
- **Biofuncional:** Sono/ritmos · Energia/recuperação · GI · Cardiovascular/autonômico · Respiratório · Endócrino/metabólico · Imune/inflamatório · Pele/cabelo/unhas · Urinário/íntimo.
- **Biomecânico:** (autorrelato) Dor · Rigidez · Limitação · Força · Equilíbrio | (exame) Mobilidade · Força · Padrões de movimento · Cervical · Lombar · Quadril/SI · Palpação/testes.

---

## 5. Módulos oficiais (Camada 3) — regras inegociáveis

| Instrumento | Itens | Escala | Período | Respondente | Escore | Observações |
|---|---|---|---|---|---|---|
| **GAD-7** | 7 | 0-3 | **2 semanas** | Paciente | 0-21 (faixas 0-4/5-9/10-14/15-21; corte de rastreio 10, **não diagnóstico**) | Módulo próprio por causa do período (2 sem ≠ 30 dias). |
| **PHQ-9** | 9 | 0-3 | **2 semanas** | Paciente | 0-27 | Item 9 = ideação → **alerta**. Módulo próprio. |
| **MADRS** | 10 | 0-6 | **7 dias** | **Profissional** (heteroaplicado) | 0-60 | Camada 2. **Copyright/licença a validar com Lex antes de embutir no SaaS.** |
| **QRM completo** | (68) | por seção | 30 dias | Paciente | totais/seções | Opcional; itens conceituais já cobertos pelo mestre. |
| **Q-SNA completo** | (45) | 0-4 | 30 dias | Paciente | 0-180 | Opcional; conceitos já cobertos pelo mestre. |

**Regra:** o número oficial destes instrumentos só existe se o módulo for respondido no formato dele. O mestre **não fabrica** GAD-7/PHQ-9/MADRS. O que o mestre dá é a leitura Bio³ do MESMO conceito (rotulada como Bio³, não como o instrumento).

---

## 6. Cobertura, segurança e display (já parcialmente implementado)

- **Estados por pilar:** Completo / Parcial / Aguardando exame (Biomecânico) / Sem dados. Nunca "100% Solto" em pilar vazio. **Campo em branco ≠ zero.** ✅ já no ar.
- **Bandas (internas, não diagnósticas):** hoje disfunção 0-30 solto / 31-69 tenso / 70-100 bloqueado. *(Decisão pendente: 2ª opinião sugeriu 0-49 / 50-74 / 75-100 por equilíbrio. Validar com dados reais antes de tratar como clínico.)*
- **Segurança (fora do score):** item de ideação → encaminhamento 988/188 + lead urgente; cardiorrespiratório frequente → precaução. ✅ já no ar.

---

## 7. O que JÁ existe no código vs. o que FALTA construir

**Já no ar (deploy de 2026-09-14):**
- Formulário-mestre v1 (blocos A-H) renderizado do código, escala `bio3_severity` 0-4.
- Pilares a partir do formulário; cobertura por pilar (fim do 100% falso); Biomecânico aguardando exame.
- Anamnese automática em camadas (rascunho) + "Importar achados" e "Extrair medicação" lendo o formulário.
- Alertas de segurança.

**Falta construir (este spec):**
1. **Normalização por SUBDOMÍNIO** (§4) — hoje o pilar é média direta dos itens (dilui). É a mudança de maior impacto clínico. Mexe em `scoring.ts` + catálogo (tag de subdomínio por item) + testes.
2. **Módulos oficiais GAD-7 e PHQ-9** como questionários próprios de 2 semanas (reusa a infra de assessment_templates), com escore e faixas, disparáveis pela clínica. Alerta do item 9 do PHQ-9.
3. **MADRS** na Camada 2 (tela do terapeuta) — **bloqueado até Lex validar licença.**
4. **Índice geral honesto:** excluir do índice pilar "não confiável" (ex.: Biomecânico aguardando exame), pra o número geral não inflar.
5. **Limpeza do catálogo:** os itens legados `qrm_*`/`qsna_*`/`msq_*` convivem com os `bm_/bf_/be_` do mestre (duplicação conceitual). Decidir: manter (para quem usa QRM/Q-SNA separado) ou esconder por padrão.
6. **Rótulo no relatório:** deixar explícito "leitura Bio³ (não é escore GAD-7/PHQ-9/MADRS)".

---

## 8. Decisões pendentes para Marcelo

1. **Adotar a normalização por subdomínio?** (recomendo sim — resolve a diluição; muda os números dos pilares, para melhor.)
2. **Quer GAD-7 e PHQ-9 oficiais** (2 semanas, escore validado) como módulos opcionais, ou basta a leitura Bio³ do humor/ansiedade?
3. **MADRS:** vai usar clinicamente? Se sim, autorizo o Lex a checar licença.
4. **Bandas:** manter 0-30/31-69/70-100 (disfunção) ou migrar para a proposta 75/50 (equilíbrio)? (Sugiro validar com dados reais antes.)
5. **Itens legados QRM/Q-SNA/MSQ:** manter visíveis ou esconder por padrão nas clínicas que usam o mestre?

Depois das suas respostas, eu quebro em PRs pequenos (começando pela normalização por subdomínio, que é o maior ganho clínico).

---

## 9. Decisões aprovadas por Marcelo (2026-09-14)

1. **Normalização por subdomínio: SIM.** (§4) Maior ganho clínico. Primeiro PR.
2. **GAD-7 + PHQ-9/MADRS-S como bloco de tempo próprio DENTRO do mesmo formulário.** NÃO usar 21 dias (invalidaria os instrumentos). O bloco emocional roda no recall do instrumento (GAD-7 = 2 semanas; MADRS-S = ~últimos dias), rotulado; o resto do formulário fica em 30 dias. O pilar Bioemocional passa a ser leitura de janela curta (adequado p/ humor/ansiedade). Não é soma de itens: **troca** os itens Bio³-style atuais (~19) pelos oficiais (16), sem aumentar a carga.
3. **Depressão = MADRS-S** (autoaplicável, 9 itens 0-6, máx 54; mais sensível à mudança; alinha com o doutorado PBM/depressão de Marcelo). **Ansiedade = GAD-7.** UM instrumento de depressão só (sem redundância). **Fallback = PHQ-9** (domínio público) se a licença travar. ⚠️ **MADRS-S tem copyright → Lex precisa checar licença antes de embutir no SaaS** (a versão anexada é a de marca da Flow Neuroscience e NÃO pode ser copiada; usar os itens só com licença). MADRS-S também fica **à disposição como módulo opcional** para casos específicos.
4. **Bandas: esquema de 4 NÍVEIS** (substitui as 3 atuais solto/tenso/bloqueado). Cor/estado saem da disfunção; paciente vê equilíbrio:
   | Equilíbrio | Disfunção | Estado | Cor |
   |---|---|---|---|
   | 75–100% | 0–25% | Equilibrado | 🟢 |
   | 50–74% | 26–50% | Merece atenção | 🟡 |
   | 25–49% | 51–75% | Prioridade de cuidado | 🟠 |
   | 0–24% | 76–100% | Prioridade elevada | 🔴 |
   Bandas internas, não diagnósticas. Toca bands.ts + cores + i18n (3 locales) + painel + PDF + anel + semáforo dos questionários. PR próprio.
5. **Esconder itens legados QRM/Q-SNA/MSQ por padrão** nas clínicas que usam o mestre (reativáveis por clínica).

### Ordem de execução (PRs pequenos)
1. Normalização por subdomínio (scoring + tag de subdomínio no catálogo + testes) — MAIOR ganho.
2. Bandas de 4 níveis (bands.ts + i18n + consumidores).
3. Esconder legados por padrão + índice geral honesto (exclui pilar não-confiável).
4. Módulo GAD-7 oficial (2 semanas) no formulário.
5. Módulo depressão: MADRS-S se Lex liberar licença; senão PHQ-9. + MADRS-S como módulo opcional enviável.

