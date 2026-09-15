# RASCUNHO — Copy Bio³ em equilíbrio (relatório do paciente)

> **STATUS: RASCUNHO REVISADO (Aval + Termo em 02/09/2026: "aprovado com ajustes", ajustes aplicados abaixo). NÃO PUBLICAR até OK de Marcelo + revisão de advogado humano.**
> Origem: sessão de 02/09/2026. Só reescreve o que muda de DIREÇÃO do número
> (Beat 2, Beat 5, legenda). Beats 1, 3, 4, 6, 7, autoridade, prova social,
> disclaimer e salvaguarda **seguem os aprovados em 2026-06-18** (`_COPY_BIO3_RELATORIO.md`),
> sem alteração. Arquivo alvo na implementação: `modules/neuro-id/report-copy.ts`
> (usado por `buildNeuroIdPatientReportPdf` em `services/neuro-id-pdf-service.ts`).

## Mudança de base

- Número exibido ao paciente passa a ser **equilíbrio = 100 − disfunção** (maior = melhor).
- A **faixa** (solto/tenso/bloqueado) continua vindo da **disfunção crua** (estado clínico).
  Só a leitura ao paciente inverte de direção.
- Nome do índice passa a ser **"Índice Bio³ de equilíbrio"** (antes "Índice Bio · grau de disfunção").
- Placeholder técnico: introduzir `{equilibrio}` (= 100 − índice de disfunção). A banda de copy
  (`copyBandForDysfunction`) NÃO muda: continua calculada sobre a disfunção.

---

## Beat 2 — "Seu retrato hoje" (por faixa)

**solto** (equilíbrio alto):
> Reunimos tudo o que avaliamos em um retrato único, o seu Índice Bio³ de equilíbrio. Hoje ele está em {equilibrio}%: nesse retrato seu equilíbrio está alto. As áreas avaliadas vêm se mantendo bem, e o foco agora é proteger e sustentar isso.

**tenso** (equilíbrio parcial):
> Reunimos tudo o que avaliamos em um retrato único, o seu Índice Bio³ de equilíbrio. Hoje ele está em {equilibrio}%: há um equilíbrio parcial, com áreas que vêm "segurando as pontas" há um tempo e isso cobra um preço. A boa notícia é que esse quadro costuma responder bem quando cuidamos da causa.

**bloqueado** (equilíbrio reduzido):
> Reunimos tudo o que avaliamos em um retrato único, o seu Índice Bio³ de equilíbrio. Hoje ele está em {equilibrio}%: o equilíbrio está reduzido, e seu corpo vem fazendo um esforço grande pra te manter de pé. Isso não é pra assustar: é pra mostrar que existe um caminho de cuidado, e ele começa por um ponto específico.

## Beat 5 — "O caminho" (por faixa)

**intro** (direção como META, não como fato futuro):
> O seu Índice Bio³ de equilíbrio é o seu norte. A meta do cuidado é simples de enxergar: apoiar seu equilíbrio para que ele tenda a subir ao longo do acompanhamento.

**solto:**
> No seu caso, o caminho é de manutenção inteligente: pequenos ajustes pra você seguir em função e equilíbrio por muito mais tempo.

**tenso:**
> No seu caso, o caminho é de recuperação: a cada etapa a gente reavalia e você acompanha como o seu equilíbrio evolui, eixo por eixo. Não é da noite pro dia, é consistente.

**bloqueado:**
> No seu caso, o caminho é de reorganização profunda, com passos claros. A cada reavaliação você acompanha a evolução do seu equilíbrio, medido e registrado, preto no branco.

## Legenda (troca faixas numéricas por qualitativa, igual à tela)

De:
> 0–30 em função · 31–69 disfunção crônica · 70–100 grande disfunção

Para:
> Solto = em bom equilíbrio · Tenso = merece atenção · Bloqueado = prioridade de cuidado

---

## Pontos para Aval / Termo revisarem

- **"costuma responder bem quando cuidamos da causa"** (Beat 2 tenso): mantido o "costuma" (hedge),
  sem promessa. Termo confirmar tom structure/function.
- **Direção positiva** ("vê-lo subir", "equilíbrio crescer"): confirmar que não vira promessa
  implícita de que o tratamento causa a melhora. Intenção é descritiva (o índice do modelo sobe
  nas reavaliações), não claim de resultado garantido.
- **Nunca "% saudável"**: mantido. É sempre "equilíbrio".
- **Faixas**: limiares numéricos invertidos ficam escondidos (legenda vira qualitativa) para não
  expor "70–100 = ótimo".
- Termos proibidos (cura, garantia, 100%, sem efeitos colaterais, definitivo): nenhum usado.

## Depois do OK (implementação, sessão futura)

1. Aplicar as versões acima em `report-copy.ts` (Beat 2/5 + intro), adicionar `{equilibrio}`.
2. Em `buildNeuroIdPatientReportPdf`: número herói → equilíbrio; trocar a pirâmide pelo anel
   Bio³ desenhado no pdfkit (via `doc.path()` com os mesmos caminhos de fatia/borda); legenda nova.
3. `buildNeuroIdMapPdf` (view=clinical) permanece em disfunção. Doc 1 (`buildNeuroIdDoc1Pdf`) é peça à parte.
