# BRIEF — Polish mobile do Bio³ (AXIEL Core é PWA, mesmo código)

> O Core é um app web/PWA instalado no celular (não há app nativo). O dashboard já é responsivo; falta deixar as telas NOVAS do Bio³ confortáveis no celular. SÓ layout/CSS — nenhuma mudança de lógica/cálculo. Mobile-first (default = celular; `sm:`/`md:` para telas maiores). Alvo: viewport ~375px.

## Telas a ajustar
1. **Formulário "Nova avaliação"** (`components/patient-neuro-id-panel.tsx` e a tela de entrada): 1 coluna no celular (`grid-cols-1 sm:grid-cols-2`). Inputs largura total, altura de toque ≥44px, label acima do campo. Seções (Biomecânico/Bioquímico/Bioemocional) empilhadas.
2. **Pirâmide + Índice Bio**: largura FLUIDA — trocar `w-[190px]` fixo por `w-full max-w-[260px] mx-auto`; SVG com `viewBox` e `width=100%`. Número-herói (Índice Bio) grande e centralizado; % de cada eixo legível.
3. **Faixas/chips (solto/tenso/bloqueado)**: `flex-wrap`, não estourar a largura.
4. **Colar QRM/Q-SNA (Fase 2)**: `textarea` largura total, fácil de colar no celular.
5. **Botões** (Nova avaliação, Importar respostas, Calcular Mapa, Revisar e completar): `w-full sm:w-auto` no mobile, tap target grande; não amontoar — empilhar no celular.
6. **Banners** (auto_draft / "complete o exame físico" / parcial): largura total, sem corte de texto.
7. **PDF**: garantir que abre/baixa no Safari iOS (link com target adequado; sem depender de popup bloqueado).

## Regras
- Não alterar lógica, cálculo, dados ou textos clínicos — só responsividade/layout.
- Mobile-first: estilos default servem o celular; `sm:`/`md:` para desktop.
- Conferir em ~375px (iPhone) e ~768px (tablet).
- Manter acessibilidade (contraste, tamanho de toque).

## Aceite
- [ ] Formulário Bio³ em 1 coluna no celular, sem campos espremidos.
- [ ] Pirâmide + Índice Bio legíveis e fluidos no celular.
- [ ] Botões full-width e fáceis de tocar.
- [ ] PDF abre no celular.
- [ ] Nada de lógica mudou; build/testes verdes.

## Kickoff (cole na sessão do repo do Core)
> "Leia CONTEXT.md e _BRIEF_BIO3_MOBILE.md. Faça um polish de responsividade MOBILE-FIRST nas telas do Bio³ (sem mudar lógica/cálculo/textos): (1) formulário 'Nova avaliação' em 1 coluna no celular (grid-cols-1 sm:grid-cols-2), inputs full width, tap target ≥44px; (2) pirâmide/Índice Bio com largura fluida (trocar w-[190px] por w-full max-w-[260px] mx-auto; SVG width=100%); (3) chips de faixa com flex-wrap; (4) textarea de QRM/Q-SNA full width; (5) botões w-full sm:w-auto, empilhados no celular; (6) banners sem corte; (7) garantir que o PDF abre no Safari iOS. Mobile-first: default serve o celular, sm:/md: para desktop. Conferir em ~375px. Não altere lógica nem textos clínicos. Build e testes verdes. Pergunte só em decisão ambígua. NÃO faça deploy sem meu OK."
