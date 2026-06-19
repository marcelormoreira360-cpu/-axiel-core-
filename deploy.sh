#!/usr/bin/env bash
#
# deploy.sh — valida e publica o AXIEL Core (commit + push -> Vercel deploya).
#
# Uso:
#   ./deploy.sh "mensagem do commit"
#   ./deploy.sh                       # usa uma mensagem padrão com a data
#
# O que faz, em ordem:
#   1. Remove locks órfãos do git (.git/index.lock, .git/HEAD.lock)
#   2. Roda as validações (tsc + verify:i18n + testes) — ABORTA se algo falhar
#   3. git add -A  (exceto os arquivos ignorados pelo .gitignore)
#   4. commit com a mensagem informada
#   5. push para origin/main  (isto dispara o deploy na Vercel)
#
# Nada é enviado se a validação falhar. Rode sempre da raiz do projeto.

set -euo pipefail

# Vai para a pasta do script (raiz do projeto), seja de onde for chamado.
cd "$(dirname "$0")"

MSG="${1:-chore: deploy $(date '+%Y-%m-%d %H:%M')}"

echo "──────────────────────────────────────────────"
echo " AXIEL Core · deploy"
echo " Commit: $MSG"
echo "──────────────────────────────────────────────"

# 1) Locks órfãos (acontece quando um git anterior foi interrompido)
rm -f .git/index.lock .git/HEAD.lock 2>/dev/null || true

# 2) Validações — qualquer falha aborta antes de tocar no git
echo "▶ TypeScript (tsc)…"
if [ -f tsconfig.check.json ]; then
  npx tsc -p tsconfig.check.json --noEmit
else
  npx tsc --noEmit
fi
echo "✓ tsc OK"

echo "▶ i18n (verify:i18n)…"
npm run --silent verify:i18n
echo "✓ i18n OK"

echo "▶ Testes (npm test)…"
npm test --silent
echo "✓ testes OK"

# 3) Há algo para commitar?
if [ -z "$(git status --porcelain)" ]; then
  echo "Nada para commitar — árvore limpa. Saindo."
  exit 0
fi

# 4) Stage + commit
git add -A
git commit -m "$MSG"

# 5) Push (dispara o deploy na Vercel)
echo "▶ push origin main…"
git push origin main

echo "──────────────────────────────────────────────"
echo "✓ Enviado. A Vercel vai iniciar o deploy automaticamente."
echo "──────────────────────────────────────────────"
