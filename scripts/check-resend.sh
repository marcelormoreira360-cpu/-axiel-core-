#!/usr/bin/env bash
# Confere a configuração de e-mail (Resend) do AXIEL/OXIEL Core.
# Uso:
#   bash scripts/check-resend.sh              -> só diagnostica (chave + domínios, sem enviar nada)
#   bash scripts/check-resend.sh seu@email    -> diagnostica e envia UM e-mail de teste para o endereço dado
#
# Lê RESEND_API_KEY e RESEND_FROM_EMAIL de .env.local. Não imprime a chave.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
[ -f "$ENV_FILE" ] || { echo "❌ Não achei $ENV_FILE"; exit 1; }

KEY=$(grep '^RESEND_API_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
FROM=$(grep '^RESEND_FROM_EMAIL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)

[ -n "$KEY" ]  || { echo "❌ RESEND_API_KEY vazia em $ENV_FILE"; exit 1; }
[ -n "$FROM" ] || { echo "❌ RESEND_FROM_EMAIL vazia em $ENV_FILE"; exit 1; }

# Extrai o domínio do remetente:  "Nome <algo@dominio.com>"  -> dominio.com
FROM_ADDR=$(printf '%s' "$FROM" | sed -E 's/.*<([^>]+)>.*/\1/')
FROM_DOMAIN=$(printf '%s' "$FROM_ADDR" | sed -E 's/.*@//')

echo "Remetente configurado : $FROM"
echo "Domínio do remetente  : $FROM_DOMAIN"
echo

if [ "$FROM_DOMAIN" = "resend.dev" ]; then
  echo "⚠️  Você ainda está no SANDBOX (onboarding@resend.dev)."
  echo "    Mesmo com chave válida, a Resend só entrega no e-mail dono da conta."
  echo "    Verifique um domínio próprio e troque o RESEND_FROM_EMAIL."
  echo
fi

echo "== 1) Validade da chave (GET /domains) =="
HTTP=$(curl -s -o /tmp/resend_domains.json -w "%{http_code}" \
  -H "Authorization: Bearer $KEY" https://api.resend.com/domains)

SENDING_ONLY=0
if [ "$HTTP" = "401" ] && grep -q "restricted" /tmp/resend_domains.json; then
  echo "✅ Chave VÁLIDA (tipo 'Sending access' — só envia, não lista domínios)."
  echo "   Pulo a listagem de domínios; o que importa é o teste de envio abaixo."
  SENDING_ONLY=1
elif [ "$HTTP" != "200" ]; then
  echo "❌ Chave INVÁLIDA ou sem permissão (HTTP $HTTP)."
  cat /tmp/resend_domains.json; echo
  echo "→ Gere uma nova API key no painel da Resend e cole em RESEND_API_KEY."
  exit 1
else
  echo "✅ Chave válida (HTTP 200, acesso total)."
fi
echo

if [ "$SENDING_ONLY" = "1" ]; then
  echo "== 2) Domínios na conta e status =="
  echo "   (pulado — chave de envio não tem permissão de leitura de domínios)"
  echo
else
  echo "== 2) Domínios na conta e status =="
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$FROM_DOMAIN" /tmp/resend_domains.json <<'PY'
import json, sys
target = sys.argv[1]
data = json.load(open(sys.argv[2]))
doms = data.get("data", data) if isinstance(data, dict) else data
found = None
for d in doms:
    name = d.get("name"); status = d.get("status")
    mark = "  <- remetente" if name == target else ""
    print(f"  - {name}: {status}{mark}")
    if name == target: found = status
print()
if target == "resend.dev":
    print("Remetente ainda e o sandbox. Configure um dominio proprio.")
elif found is None:
    print(f"O dominio do remetente ({target}) NAO esta cadastrado na Resend.")
elif found != "verified":
    print(f"O dominio {target} existe mas esta '{found}', nao 'verified'.")
else:
    print(f"Dominio {target} VERIFICADO. Pronto para enviar a pacientes.")
PY
  else
    echo "(python3 indisponivel — mostrando bruto)"; cat /tmp/resend_domains.json; echo
  fi
  echo
fi

# 3) Envio de teste (só se um destinatário for passado)
TO="${1:-}"
if [ -n "$TO" ]; then
  echo "== 3) Enviando e-mail de teste para: $TO =="
  RESP=$(curl -s -o /tmp/resend_send.json -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"from":sys.argv[1],"to":[sys.argv[2]],"subject":"Teste AXIEL/OXIEL Core","html":"<p>Teste de envio do Core. Se você recebeu, o e-mail está funcionando.</p>"}))' "$FROM" "$TO")" \
    https://api.resend.com/emails)
  if [ "$RESP" = "200" ]; then
    echo "✅ Enviado (HTTP 200). Cheque a caixa de entrada de $TO."
  else
    echo "❌ Falha no envio (HTTP $RESP):"
    cat /tmp/resend_send.json; echo
  fi
else
  echo "== 3) Envio de teste pulado (nenhum destinatário passado) =="
  echo "   Para testar:  bash scripts/check-resend.sh SEU_EMAIL@dominio.com"
fi
