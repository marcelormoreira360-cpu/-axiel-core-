# KICKOFF — Go-live das features novas (Mapa Bio³ + Suplementos + Quick Wins)

> Cole o bloco abaixo na sessão do repo do AXIEL Core. Ordem segura: testar → revisar → aplicar em prod (com confirmação) → deploy → smoke test.

```
Leia CONTEXT.md primeiro. Vamos colocar no ar as features recém-construídas
(migrations 086 a 091: financeiro por paciente, valor do plano, suplementos,
indicação paciente→paciente, Mapa Bio³/neuro-id).

Siga nesta ordem e PARE e me pergunte se algo destoar:

1) TESTES: rode a suíte de testes do projeto (npm test ou o script do package.json).
   Garanta verde, em especial modules/neuro-id/__tests__/scoring.test.ts.
   Se algo falhar, conserte ou me mostre antes de continuar.

2) REVISÃO DAS MIGRATIONS: liste as migrations 086→091 e confirme quais ainda
   NÃO foram aplicadas no banco de PRODUÇÃO. Verifique se alguma é destrutiva
   (drop/alter que perca dado). Se for, PARE e me avise — não aplique.

3) APLICAR EM PRODUÇÃO: aplique as migrations pendentes na Supabase de produção
   seguindo o processo documentado no CONTEXT.md. Confirme RLS por clinic_id em
   todas as tabelas novas. Rode os advisors do Supabase e me mostre warnings.
   ⚠️ Não apague nem altere dados existentes. Peça minha confirmação antes do
   comando que escreve em produção.

4) DEPLOY: faça o deploy (Vercel). Se o push já dispara deploy automático,
   apenas confirme que o último deploy subiu verde.

5) SMOKE TEST: abra um paciente de teste e verifique, sem erro no console:
   - Mapa Bio³ gera os 3 eixos + índice + prioridade, exibindo em equilíbrio;
   - o PDF herói do Mapa Bio³ baixa corretamente;
   - aparecem: valor do plano, resumo financeiro do paciente, campo de
     indicação, e a aba/seção de suplementos.

Ao final, me dê um resumo: o que foi aplicado em prod, status do deploy,
warnings dos advisors, e o que ainda falta. NÃO faça nada irreversível sem OK.
```
