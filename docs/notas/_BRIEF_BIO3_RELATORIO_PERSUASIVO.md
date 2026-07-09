# BRIEF — Relatório Bio³ persuasivo-ético (mais venda, engajamento e desejo)

> Infundir vendas/marketing no relatório Bio³ de forma LEVE e AGRADÁVEL, gerando mais conversão, engajamento e desejo de tratamento — sem pressão, medo ou promessa de cura. O relatório É o Report of Findings.
> Times: **Celso** (enrollment) + **Verbo** (copy/voz) escrevem; **Aval/Termo** revisam; **Nucleo** implementa no `services/neuro-id-pdf-service.ts` como copy dinâmica.

## 1. Princípio inegociável
Persuasão ética = **clareza + significado + caminho**. NUNCA medo, urgência forçada, culpa, pressão ou claim de cura/garantia. O paciente decide por entender e desejar. Compliance (Termo/Aval): linguagem structure/function, sem diagnóstico fechado, disclaimers mantidos.

## 2. Estrutura — relatório como jornada (7 beats)
1. **"Eu te ouvi"** — abre com as queixas nas palavras do paciente (do intake/SOAP). → empatia + personalização.
2. **"Seu retrato hoje"** — Índice Bio + pirâmide; o número como meta/norte.
3. **"O que isso significa no seu dia a dia"** — traduz disfunção em vida (sono, energia, dor, humor, foco). → relevância/desejo.
4. **"Por onde começar (a boa notícia)"** — pilar prioritário como vitória mais rápida. → esperança + momentum.
5. **"O caminho"** — visão do depois + reavaliação (ver o número baixar). → future pacing.
6. **"Se nada mudar"** — trajetória honesta (desequilíbrio crônico → possíveis crises), com cuidado, não susto. → urgência ética.
7. **"Seu próximo passo"** — UM CTA claro: o plano amarrado ao mapa.
Tempero: autoridade (método/ciência, leve) + prova social ética anonimizada.

## 3. Copy dinâmica por faixa (personalização = conversão)
O texto muda conforme o Índice Bio / pilar prioritário:
- **0–30 (em função):** tom "otimizar e manter o que está bom".
- **31–69 (disfunção crônica):** "dá pra reverter; o caminho é claro e começa por [pilar]".
- **70–100 (grande disfunção):** "seu corpo pede cuidado agora; existe um caminho estruturado".
Variar também por **pilar prioritário** (mensagem específica p/ Biomecânico/Bioquímico/Bioemocional) e citar 1–2 sintomas reais do paciente.

## 4. Alavancas (cada uma com guarda-corpo)
- Personalização (palavras do paciente) · Significado (disfunção→vida) · Norte (o número) · Quick win (prioridade) · Future pacing (reavaliação) · Urgência ética (trajetória, sem medo) · Autoridade (método) · Prova social (anonimizada, consentida) · CTA único.
- PROIBIDO: cura/garantia, "100%", medo, comparação que envergonha, escassez falsa, contagem regressiva.

## 5. Tom (Verbo)
Caloroso, "você", frases curtas, sem jargão, esperançoso e respeitoso. Exemplo:
- ❌ "Eixo Bioemocional: disfunção 72% (bloqueado)."
- ✅ "Hoje seu sistema nervoso está no centro do que você sente — é o ponto que mais pede cuidado e, por isso mesmo, o que costuma trazer alívio mais rápido quando começamos por ele."

## 6. Implementação (Nucleo)
- Em `neuro-id-pdf-service.ts`: blocos de copy por beat, escolhidos por faixa + pilar prioritário (tabela de strings + seleção por score). Reusar Índice Bio, pirâmide, prioridade, contribuição relativa já calculados.
- Manter versão clínica (interna) separada da versão paciente (persuasiva).
- A copy fica em um módulo de strings revisável (`modules/neuro-id/report-copy.ts`) p/ Celso/Verbo editarem sem mexer no layout.
- Toda string passa por Aval/Termo antes de produção.

## 7. Aceite
- [ ] PDF do paciente segue os 7 beats; copy muda por faixa e por pilar prioritário.
- [ ] Cita ≥1 queixa real do paciente; tem 1 CTA claro.
- [ ] Zero termos proibidos (lista §4); disclaimers presentes.
- [ ] Versão clínica interna preservada.
- [ ] Revisão Aval/Termo registrada.

## 8. Kickoff (cole na sessão do repo do Core) — só após Celso/Verbo entregarem a copy
> "Leia CONTEXT.md e _BRIEF_BIO3_RELATORIO_PERSUASIVO.md. Crie `modules/neuro-id/report-copy.ts` com os blocos de copy dos 7 beats, variando por faixa (0–30/31–69/70–100) e por pilar prioritário, e integre no neuro-id-pdf-service.ts (versão paciente; manter a clínica interna). Sem cura/garantia/medo (lista §4); manter disclaimers. Não recalcule scores; só consuma os existentes. Testes do seletor de copy verdes. Pergunte só em decisão ambígua. NÃO faça deploy sem meu OK."
