# BRIEF — Refinos visuais do Bio³ (4 pontos do teste de Marcelo)

> Refinos de clareza/visual. Sem mudar cálculo. Ler CONTEXT.md. Times: Nucleo.

## 1. Deixar claro: % geral vs % por pilar
Hoje o número-herói é o Índice geral e os 3 cards são por pilar, mas não está rotulado.
→ No topo: rótulo **"Índice geral · todos os eixos · grau de disfunção (menor = melhor)"**. Nos 3 cards: subtítulo **"disfunção do eixo"**. Assim o terapeuta não confunde geral × pilar.

## 2. Relatório AI Insight (Documento 1) ainda é vertical → aplicar o redesign
O redesign escaneável entrou no painel Bio³, mas NÃO no relatório de insight (`components/ai-insight-review-card.tsx`, `components/neuro-id-360-documents.tsx`, `components/ai-insight-panel.tsx`).
→ Aplicar a mesma hierarquia: **resumo no topo** (achado principal + demografia compacta) e os blocos (Documento 1/2/3, Exames, Resultados, Síntese, Conclusão) em **acordeão `<details>` recolhido**. Mesmo conteúdo, sem parede vertical.
→ Fonte única ao vivo: a **revisão na web** deve ler a demografia do CADASTRO em tempo real (igual ao PDF), pra insights antigos não mostrarem "não informado" depois de preenchido. Trocar "0 ano" por "—" quando não há data de nascimento.

## 3. Pirâmide — cores mais vivas (não é bug)
A pirâmide já colore por faixa (`bandForDysfunction`); quando todos os eixos estão na faixa verde (0–30 Solto), fica tudo verde — correto. Problema: o tint está apagado.
→ Realçar: **preenchimento mais forte** (usar um tom mais saturado da banda) **+ borda colorida da banda** (hoje o stroke é branco) pra dar definição. Manter a lógica por faixa. Garantir contraste do texto do % em cada tier.

## 4. Questionários — restaurar semáforo por severidade
As telas de resultado de questionário usam verde fixo, perdendo o nível do problema:
`components/patient-assessment-progress-panel.tsx`, `app/patients/[id]/forms/[responseId]/page.tsx`, e o bloco "Evolução dos questionários" em `app/patients/[id]/page.tsx`.
→ Colorir **barras e valores por severidade** com o mesmo semáforo do Bio³: converter o % da seção/total em faixa via `bandForDysfunction` (0–30 verde, 31–69 âmbar, 70–100 vermelho) e aplicar a cor na barra + no número. Manter o rótulo de texto (acessível).

## Aceite
- [ ] Topo rotula "Índice geral"; cards rotulam "disfunção do eixo".
- [ ] Relatório de insight em resumo + acordeão (não vertical); web lê demografia ao vivo; "—" quando sem idade.
- [ ] Pirâmide com cores vivas + borda por banda (lógica por faixa mantida).
- [ ] Questionários (seção/total/evolução) coloridos por severidade (semáforo).
- [ ] Sem mudança de cálculo. Mobile-first. Build e testes verdes.

## Kickoff (cole na sessão do repo do Core)
> "Leia CONTEXT.md e _BRIEF_BIO3_REFINOS.md. Refinos visuais (sem mudar cálculo):
> (1) Rotule no painel Bio³: topo = 'Índice geral · todos os eixos · grau de disfunção (menor = melhor)'; cada um dos 3 cards = subtítulo 'disfunção do eixo'.
> (2) Aplique o redesign escaneável (resumo no topo + acordeão <details>) ao relatório de AI Insight (ai-insight-review-card / neuro-id-360-documents / ai-insight-panel) — mesmo conteúdo, sem parede vertical; a revisão web deve LER a demografia do cadastro ao vivo (igual ao PDF) e mostrar '—' quando não há data de nascimento.
> (3) Realce as cores da pirâmide (NeuroPyramid): preenchimento mais saturado + borda colorida da banda (em vez de branca), mantendo a lógica por faixa.
> (4) Aplique o semáforo por severidade (bandForDysfunction sobre o % da seção/total → verde/âmbar/vermelho) nas barras e valores dos questionários: patient-assessment-progress-panel.tsx, app/patients/[id]/forms/[responseId]/page.tsx e o bloco 'Evolução dos questionários' em app/patients/[id]/page.tsx; manter rótulo de texto.
> Mobile-first. Não altere lógica de cálculo. Build e testes verdes. Pergunte só em decisão ambígua. NÃO faça deploy sem meu OK."
