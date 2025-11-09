#!/usr/bin/env bash
# terminal_client.sh — Executar localmente no seu terminal
# Uso: ./terminal_client.sh
set -euo pipefail

SERVER_URL="const SERVER_URL = "https://d7f8-201-6-88-122.ngrok-free.app";"
TOKEN="${TERMINAL_TOKEN:-troque-por-um-token-muito-forte}"
REQUIRE_WHITELIST=true  # definir false se quiser permitir qualquer comando (não recomendado)

if [ -z "$TOKEN" ]; then
  echo "ERRO: TERMINAL_TOKEN não definido. Exporte TERMINAL_TOKEN antes de rodar."
  exit 1
fi

while true; do
  printf "\n> Pergunte à IA (ex: 'como atualizar pacote X' ou 'sugira comando para listar arquivos'): "
  read -r USER_PROMPT
  if [ -z "$USER_PROMPT" ]; then
    echo "Saindo."
    exit 0
  fi

  # Solicita sugestão à IA
  RESP=$(curl -sS -X POST "$SERVER_URL/suggest" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": $(printf '%s' "$USER_PROMPT" | jq -R .)}" )

  echo -e "\n=== Resposta bruta da IA ==="
  echo "$RESP" | jq -r '.raw // .'
  echo "============================"

  # Pergunta se usuário quer extrair/rodar algum comando
  printf "\nDeseja executar algum comando sugerido manualmente? (digite o comando exatamente ou ENTER para pular): "
  read -r TO_RUN

  if [ -z "$TO_RUN" ]; then
    echo "Nenhum comando solicitado. Você pode fazer outra pergunta."
    continue
  fi

  # Confirmação explícita
  printf "CONFIRMA execução de: %s ? (sim / nao): " "$TO_RUN"
  read -r CONF
  if [[ "$CONF" != "sim" && "$CONF" != "s" ]]; then
    echo "Execução cancelada."
    continue
  fi

  # Envia para execução ao servidor (este fará checagens)
  PAYLOAD=$(jq -n --arg cmd "$TO_RUN" --argjson wl "$REQUIRE_WHITELIST" '{ command: $cmd, requireWhitelist: $wl }')
  OUT=$(curl -sS -X POST "$SERVER_URL/exec" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  echo -e "\n--- Resultado ---"
  echo "$OUT" | jq -r '.stdout // empty'
  echo "$OUT" | jq -r '.stderr // empty' >&2 || true
  echo "-----------------"
done
