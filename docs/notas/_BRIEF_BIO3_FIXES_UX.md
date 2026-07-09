# BRIEF — Bio³: 5 fixes + redesign escaneável (do teste de Marcelo 2026-06-18)

> Cinco pontos achados no teste real. SÓ o que está descrito; reusar o que existe. Ler CONTEXT.md. Times: Nucleo (UI) + Forja (dados/fluxo).

## 1. Auto-gerar também no preenchimento IN-APP
Hoje `autoUpsertNeuroIdDraft` só dispara em `app/api/forms/submit/route.ts` (link público). Quando o terapeuta preenche o formulário DENTRO do app, não gera o Mapa.
→ Chamar `autoUpsertNeuroIdDraft(patientId, clinicId)` também no caminho de salvar resposta in-app (assessment-service / a action do "+ Preencher"). Idempotência já existe.

## 2. Decimais (normalização) — MANTER (não é bug)
A resposta é inteira (0–4); o decimal vem de `(raw/max)×10` (ex.: MENTE 6/32 → 1,9). É proporção correta — **manter**, não arredondar.
→ Nenhuma mudança no cálculo. Opcional (nice-to-have): tooltip/hint no campo mostrando a origem, ex.: "normalizado de 6/32".

## 3. Demografia flui pra ficha (fonte única — completar captura)
O encanamento funciona (cidade já flui). Falta CAPTURAR idade/sexo/peso/altura.
→ Adicionar campos **data de nascimento, sexo, peso (kg), altura (cm)** em DOIS lugares: (a) o formulário de cadastro do paciente no link público (`app/envio/[slug]`) — incluir no objeto `updates`/insert; (b) a edição de perfil do paciente (terapeuta) — se ainda não houver. Idade derivada de date_of_birth (`ageFromDob`, já existe). Geradores leem do cadastro (já fazem).

## 4. "Colar QRM/Q-SNA" — REBAIXAR (decisão Marcelo)
Como Q-SNA e QRM já são formulários do Core (aparecem em "Formulários aplicados"/"Evolução"), o paste-IA é ruído no fluxo principal.
→ Mover pra um bloco recolhido **"Importar de documento externo (opcional)"** (`<details>` fechado), com 1 linha: "use se o QRM/Q-SNA vier de fora (máquina/papel)". Some do fluxo padrão, sem perder a função (Fase 2 segue ativa).

## 5. Redesign escaneável do relatório (resumo no topo, detalhe sob demanda)
Princípio (vira diretriz p/ o app): **o terapeuta bate o olho e decide; número/detalhe ficam a um clique.** Aplicar na ficha do paciente E no relatório.

### Topo da ficha do paciente (terapeuta) — DECISÃO MARCELO: pirâmide pequena + cards
- **Pirâmide pequena** (assinatura) + **3 cards** dos pilares (Biomecânico/Bioquímico/Bioemocional: % + cor da faixa + "comece aqui" no prioritário).
- Bloco **"Pontos de atenção"**: lista das piores seções/itens com barras coloridas (pior primeiro) — estilo Q-SNA/QRM que Marcelo aprovou.
- Índice Bio em destaque (número-herói).

### Detalhes em ACORDEÃO (recolhidos, `<details>`)
- Documento 1 — Relatório Funcional Integrado (texto completo atual, só recolhido)
- Plano de tratamento + Suplementação
- Questionários — Q-SNA · QRM (pontuação por seção, barras)
- Nada de conteúdo perdido — só deixa de ser "parede vertical".

### Relatório/PDF do paciente
- Mantém pirâmide + os 7 beats persuasivos (já construído). Aplicar o mesmo princípio de hierarquia (resumo → detalhe) onde couber.

## Aceite
- [ ] Preencher formulário in-app gera o Mapa Bio³ (auto) igual ao link.
- [ ] Decimais mantidos; cálculo intacto.
- [ ] Cadastro (link + perfil) captura nascimento/sexo/peso/altura → aparece na ficha e nos relatórios.
- [ ] "Colar QRM/Q-SNA" recolhido como import externo opcional.
- [ ] Ficha mostra pirâmide pequena + cards + pontos de atenção; Documento 1/Plano/Questionários em acordeão.
- [ ] Build e testes verdes.

## Kickoff (cole na sessão do repo do Core)
> "Leia CONTEXT.md e _BRIEF_BIO3_FIXES_UX.md. Implemente os 5:
> (1) chame autoUpsertNeuroIdDraft também no salvar-resposta IN-APP (não só /api/forms/submit).
> (2) NÃO arredonde os valores normalizados (decimais são corretos — proporção); opcional: hint mostrando a origem (ex.: 'normalizado de 6/32').
> (3) capture data de nascimento, sexo, peso, altura no formulário de cadastro do link público (app/envio/[slug], incluir em updates/insert) E na edição de perfil do paciente; idade via ageFromDob; geradores já leem do cadastro.
> (4) rebaixe o 'Colar QRM/Q-SNA' para um <details> recolhido 'Importar de documento externo (opcional)'.
> (5) redesenhe o topo da ficha do paciente: PIRÂMIDE PEQUENA + 3 cards dos pilares (% + cor + 'comece aqui') + bloco 'Pontos de atenção' (barras, pior primeiro); coloque Documento 1, Plano/Suplementação e Questionários em ACORDEÃO recolhido (sem perder conteúdo). Use o estilo de barras por seção do Q-SNA/QRM.
> Mobile-first. Não altere lógica de cálculo. Build e testes verdes. Pergunte só em decisão ambígua. NÃO faça deploy sem meu OK."
