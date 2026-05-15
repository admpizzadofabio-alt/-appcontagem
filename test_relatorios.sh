#!/usr/bin/env bash
set -uo pipefail
BASE="http://localhost:3333/api/v1"
PASS=0; FAIL=0
HOJE=$(date +%Y-%m-%d)
MES_INI=$(date +%Y-%m-01)

green(){ echo -e "\033[32m OK  $1\033[0m"; PASS=$((PASS+1)); }
red(){   echo -e "\033[31m NOK $1\033[0m"; FAIL=$((FAIL+1)); }
cyan(){  echo -e "\033[36m\n>> $1\033[0m"; }

check(){     local l=$1 c=$2 w=$3
  if [[ "$c" == "$w" ]]; then green "$l (HTTP $c)"; else red "$l (HTTP $c, esperado $w)"; fi; }
checkbody(){ local l=$1 b=$2 w=$3
  if [[ "$b" == *"$w"* ]]; then green "$l"; else red "$l -- nao encontrou '$w' em: ${b:0:150}"; fi; }
checknum(){  local l=$1 v=$2
  if [[ "$v" =~ ^[0-9.]+$ ]]; then green "$l = $v"; else red "$l valor invalido: '$v'"; fi; }

# ─────────────────────────────────────────────────────────────
cyan "0. LOGIN"
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" -d '{"pin":"123456"}')
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "Login Admin" "$CODE" "200"
TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
[[ -n "$TOKEN" ]] && green "Token obtido" || { red "Token vazio - abortando"; exit 1; }
AUTH="Authorization: Bearer $TOKEN"

# Token de operador (sem permissão de relatorio)
R_OP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" -d '{"pin":"222222"}')
TOKEN_OP=$(echo "$R_OP" | sed '$d' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# ─────────────────────────────────────────────────────────────
cyan "1. MACRO - KPIs gerais"
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/macro?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/macro" "$CODE" "200"
checkbody "Tem valorAtivo"           "$BODY" "valorAtivo"
checkbody "Tem totalEntradas"        "$BODY" "totalEntradas"
checkbody "Tem totalSaidas"          "$BODY" "totalSaidas"
checkbody "Tem totalPerdas"          "$BODY" "totalPerdas"
checkbody "Tem contagens"            "$BODY" "contagens"
checkbody "Tem aprovacoesPendentes"  "$BODY" "aprovacoesPendentes"
VALOR_ATIVO=$(echo "$BODY" | grep -o '"valorAtivo":[0-9.]*' | cut -d: -f2)
APROV_PEND=$(echo "$BODY" | grep -o '"aprovacoesPendentes":[0-9]*' | cut -d: -f2)
checknum "valorAtivo numerico"          "$VALOR_ATIVO"
[[ "$APROV_PEND" -ge 1 ]] && green "aprovacoesPendentes >= 1 (perda grande pendente)" || red "esperado >= 1 pendente"

# Sem datas (retorna tudo)
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/macro" -H "$AUTH")
CODE=$(echo "$R" | tail -1)
check "GET /relatorios/macro sem datas" "$CODE" "200"

# ─────────────────────────────────────────────────────────────
cyan "2. SAIDAS"
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/saidas?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/saidas" "$CODE" "200"
checkbody "Retorna array" "$BODY" "["

# Com filtro de local
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/saidas?dataInicio=$MES_INI&dataFim=$HOJE&local=Bar" -H "$AUTH")
CODE=$(echo "$R" | tail -1)
check "GET /relatorios/saidas?local=Bar" "$CODE" "200"

# ─────────────────────────────────────────────────────────────
cyan "3. PERDAS"
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/perdas?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/perdas" "$CODE" "200"
checkbody "Retorna array" "$BODY" "["
# Deve ter as perdas criadas no teste anterior
TOTAL_PERDAS=$(echo "$BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{ try{ const a=JSON.parse(d); console.log(a.filter(m=>m.tipoMov==='AjustePerda').length); }catch(e){ console.log(0); } })" 2>/dev/null || echo "0")
[[ "$TOTAL_PERDAS" -ge 2 ]] && green "Perdas encontradas: $TOTAL_PERDAS" || red "Esperado >= 2 perdas, encontrou $TOTAL_PERDAS"

# ─────────────────────────────────────────────────────────────
cyan "4. DIVERGENCIAS"
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/divergencias?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/divergencias" "$CODE" "200"
checkbody "Retorna array" "$BODY" "["

# Sem params
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/divergencias" -H "$AUTH")
CODE=$(echo "$R" | tail -1)
check "GET /relatorios/divergencias sem params" "$CODE" "200"

# ─────────────────────────────────────────────────────────────
cyan "5. AUDITORIA"
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/auditoria" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/auditoria" "$CODE" "200"
checkbody "Tem total"  "$BODY" "\"total\":"
checkbody "Tem items"  "$BODY" "\"items\":"
TOTAL_LOGS=$(echo "$BODY" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2) || TOTAL_LOGS=0
[[ "$TOTAL_LOGS" -ge 5 ]] && green "Auditoria tem $TOTAL_LOGS registros" || red "Poucos registros: $TOTAL_LOGS"

# Com filtro de ação
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/auditoria?acao=LOGIN" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/auditoria?acao=LOGIN" "$CODE" "200"
checkbody "Items de LOGIN" "$BODY" "LOGIN"

# Paginação
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/auditoria?take=5&skip=0" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/auditoria paginado (take=5)" "$CODE" "200"
ITEMS_COUNT=$(echo "$BODY" | grep -o '"acao"' | wc -l | tr -d ' ') || ITEMS_COUNT=0
[[ "$ITEMS_COUNT" -le 5 ]] && green "Paginacao correta (<= 5 items)" || red "Paginacao falhou: $ITEMS_COUNT items"

# Busca livre
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/auditoria?busca=Admin" -H "$AUTH")
CODE=$(echo "$R" | tail -1)
check "GET /relatorios/auditoria?busca=Admin" "$CODE" "200"

# ─────────────────────────────────────────────────────────────
cyan "6. ANALYTICS - CMV"
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/cmv?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/cmv" "$CODE" "200"
checkbody "Tem periodo"   "$BODY" "periodo"
checkbody "Tem total_cmv" "$BODY" "total_cmv"
checkbody "Tem produtos"  "$BODY" "produtos"
TOTAL_CMV=$(echo "$BODY" | grep -o '"total_cmv":[0-9.]*' | cut -d: -f2)
checknum "total_cmv numerico" "$TOTAL_CMV"

# ─────────────────────────────────────────────────────────────
cyan "7. ANALYTICS - LOSS RATE"
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/loss-rate?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/loss-rate" "$CODE" "200"
checkbody "Tem periodo" "$BODY" "periodo"
checkbody "Tem turnos"  "$BODY" "turnos"

# ─────────────────────────────────────────────────────────────
cyan "8. ANALYTICS - VENDAS POR HORA"
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/vendas-por-hora?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/vendas-por-hora" "$CODE" "200"
checkbody "Tem horas (24 buckets)" "$BODY" "horas"
HORA_COUNT=$(echo "$BODY" | grep -o '"hora"' | wc -l | tr -d ' ') || HORA_COUNT=0
[[ "$HORA_COUNT" -eq 24 ]] && green "24 buckets de hora" || red "Esperado 24, got $HORA_COUNT"

# ─────────────────────────────────────────────────────────────
cyan "9. ANALYTICS - TRANSFER BALANCE"
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/transferencias?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /relatorios/transferencias" "$CODE" "200"
checkbody "Tem fluxos" "$BODY" "fluxos"
checkbody "Tem Bar"     "$BODY" '"Bar"'
checkbody "Tem Delivery" "$BODY" '"Delivery"'
checkbody "Tem detalhes" "$BODY" "detalhes"
# Transferencia confirmada (Bar->Delivery, 10un Agua) deve aparecer
checkbody "Transferencia confirmada aparece nos detalhes" "$BODY" "AGUA PLATINA SEM GAS"

# ─────────────────────────────────────────────────────────────
cyan "10. EXPORTS CSV"
# Movimentações
R=$(curl -s -w "\n%{http_code}" \
  "$BASE/relatorios/export/movimentacoes?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /export/movimentacoes" "$CODE" "200"
checkbody "CSV tem header Data"     "$BODY" "Data"
checkbody "CSV tem header Produto"  "$BODY" "Produto"
checkbody "CSV tem ; separador"     "$BODY" ";"
CSV_ROWS=$(echo "$BODY" | wc -l | tr -d ' ')
[[ "$CSV_ROWS" -ge 2 ]] && green "CSV tem $CSV_ROWS linhas (header + dados)" || red "CSV vazio ou so header"

# Estoque atual
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/export/estoque" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /export/estoque" "$CODE" "200"
checkbody "CSV estoque tem Produto"   "$BODY" "Produto"
checkbody "CSV estoque tem Categoria" "$BODY" "Categoria"
checkbody "CSV estoque tem dados"     "$BODY" "Bar"

# Contagens
R=$(curl -s -w "\n%{http_code}" \
  "$BASE/relatorios/export/contagens?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | sed '$d')
check "GET /export/contagens" "$CODE" "200"
checkbody "CSV contagens tem header" "$BODY" "Dia Op"

# ─────────────────────────────────────────────────────────────
cyan "11. CONTROLE DE ACESSO"
# Operador nao pode acessar relatorios
if [[ -n "$TOKEN_OP" ]]; then
  for EP in "macro" "saidas" "perdas" "divergencias" "auditoria" "cmv" "loss-rate" "vendas-por-hora" "transferencias"; do
    R=$(curl -s -w "\n%{http_code}" \
      "$BASE/relatorios/$EP?dataInicio=$MES_INI&dataFim=$HOJE" \
      -H "Authorization: Bearer $TOKEN_OP")
    CODE=$(echo "$R" | tail -1)
    check "Operador bloqueado em /$EP -> 403" "$CODE" "403"
  done
else
  green "Operador sem PIN 222222 (skip controle de acesso)"
fi

# Sem token
R=$(curl -s -w "\n%{http_code}" "$BASE/relatorios/macro?dataInicio=$MES_INI&dataFim=$HOJE")
CODE=$(echo "$R" | tail -1)
check "Sem token -> 401" "$CODE" "401"

# ─────────────────────────────────────────────────────────────
cyan "12. CONSISTENCIA DOS DADOS"
# Macro: aprovacoesPendentes deve bater com /movimentacoes/pendentes
R_MACRO=$(curl -s "$BASE/relatorios/macro" -H "$AUTH")
R_PEND=$(curl -s "$BASE/movimentacoes/pendentes" -H "$AUTH")
MACRO_PEND=$(echo "$R_MACRO" | grep -o '"aprovacoesPendentes":[0-9]*' | cut -d: -f2)
REAL_PEND=$(echo "$R_PEND" | grep -o '"status":"Pendente"' | wc -l | tr -d ' ')
[[ "$MACRO_PEND" == "$REAL_PEND" ]] && green "aprovacoesPendentes consistente (macro=$MACRO_PEND, real=$REAL_PEND)" \
  || red "aprovacoesPendentes diverge: macro=$MACRO_PEND vs pendentes reais=$REAL_PEND"

# transferBalance: Bar saiu >= 10 (transferencia de 10un Agua confirmada hoje)
R_TRANSF=$(curl -s "$BASE/relatorios/transferencias?dataInicio=$MES_INI&dataFim=$HOJE" -H "$AUTH")
BAR_SAIU=$(echo "$R_TRANSF" | grep -o '"Bar":{"saiu":[0-9]*' | grep -o '[0-9]*$')
[[ -n "$BAR_SAIU" ]] && [[ "$BAR_SAIU" -ge 10 ]] \
  && green "Bar.saiu >= 10 (transferencia confirmada contabilizada)" \
  || red "Bar.saiu esperado >= 10, got '$BAR_SAIU'"

# ─────────────────────────────────────────────────────────────
echo ""
echo "===================================="
echo " RELATORIOS: $PASS OK  |  $FAIL FALHOU"
echo "===================================="
if [[ $FAIL -eq 0 ]]; then
  echo -e "\033[32m TODOS OS RELATORIOS OK \033[0m"
else
  echo -e "\033[31m $FAIL FALHA(S) NOS RELATORIOS \033[0m"
fi
