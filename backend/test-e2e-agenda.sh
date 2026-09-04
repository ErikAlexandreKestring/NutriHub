#!/bin/bash
# Script de demonstração ponta a ponta do módulo de Agenda — RF-08 (disponibilidade),
# RF-11 (cancelamento), RF-12 (remarcação), RN-07/08/09/10, E-10/11/12/19.
# Requer o servidor rodando em outro terminal (npm run dev).
set -e

BASE_URL="http://localhost:3000"
SUFFIX=$(date +%s)

echo "--- 1. Cadastro do nutricionista + paciente ---"
REGISTER=$(curl -s -X POST "$BASE_URL/api/auth/register" -H "Content-Type: application/json" \
  -d "{\"nome\":\"Demo Nutri\",\"email\":\"demo$SUFFIX@nutrihub.com\",\"crn\":\"CRN-3 12345\",\"senha\":\"SenhaForte123\"}")
echo "$REGISTER"
TOKEN=$(echo "$REGISTER" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).token))")

PATIENT=$(curl -s -X POST "$BASE_URL/api/patients" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"nome\":\"Paciente Teste\",\"email\":\"paciente$SUFFIX@nutrihub.com\",\"data_nascimento\":\"1995-03-10\"}")
echo "$PATIENT"
PATIENT_ID=$(echo "$PATIENT" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).id))")

echo ""
echo "--- 2. Calcular uma data futura (2 dias à frente, 10:00) e o dia da semana correspondente ---"
FUTURE_ISO=$(node -e "const d=new Date(Date.now()+2*24*60*60*1000); d.setHours(10,0,0,0); console.log(d.toISOString())")
DAY_OF_WEEK=$(node -e "console.log(new Date('$FUTURE_ISO').getDay())")
echo "FUTURE_ISO=$FUTURE_ISO DAY_OF_WEEK=$DAY_OF_WEEK"

echo ""
echo "--- 3. Cadastrar disponibilidade (RF-08): 09:00-17:00 nesse dia da semana ---"
curl -s -X POST "$BASE_URL/api/availability" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"day_of_week\":$DAY_OF_WEEK,\"start_time\":\"09:00\",\"end_time\":\"17:00\"}"
echo ""

echo ""
echo "--- 4. Tentar agendar no PASSADO (esperado: erro E-10) ---"
PAST_ISO=$(node -e "console.log(new Date(Date.now()-60*60*1000).toISOString())")
curl -s -X POST "$BASE_URL/api/patients/$PATIENT_ID/appointments" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"data_hora\":\"$PAST_ISO\"}" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 5. Tentar agendar FORA da grade, às 23:00 (esperado: erro E-11) ---"
OUTSIDE_ISO=$(node -e "const d=new Date('$FUTURE_ISO'); d.setHours(23,0,0,0); console.log(d.toISOString())")
curl -s -X POST "$BASE_URL/api/patients/$PATIENT_ID/appointments" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"data_hora\":\"$OUTSIDE_ISO\"}" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 6. Agendar dentro da grade (esperado: 201, status confirmado) ---"
APPT=$(curl -s -X POST "$BASE_URL/api/patients/$PATIENT_ID/appointments" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"data_hora\":\"$FUTURE_ISO\"}")
echo "$APPT"
APPT_ID=$(echo "$APPT" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).id))")

echo ""
echo "--- 7. Tentar agendar OUTRA consulta no MESMO horário (esperado: erro E-12) ---"
curl -s -X POST "$BASE_URL/api/patients/$PATIENT_ID/appointments" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"data_hora\":\"$FUTURE_ISO\"}" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 8. Paciente tenta cancelar a consulta de daqui a 2 dias com só 2h de 'antecedência simulada' não se aplica aqui (a consulta já está a 2 dias) — então deve ter SUCESSO ---"
curl -s -X POST "$BASE_URL/api/appointments/$APPT_ID/cancel" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"ator":"paciente"}' -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 8b. Cadastrar disponibilidade ampla (todos os dias, dia inteiro) para os próximos passos ---"
for D in 0 1 2 3 4 5 6; do
  curl -s -X POST "$BASE_URL/api/availability" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d "{\"day_of_week\":$D,\"start_time\":\"00:00\",\"end_time\":\"23:59\"}" > /dev/null
done

echo ""
echo "--- 9. Nova consulta daqui a 72h + remarcação (RF-12) ---"
ORIG_ISO=$(node -e "console.log(new Date(Date.now()+72*60*60*1000).toISOString())")
APPT2=$(curl -s -X POST "$BASE_URL/api/patients/$PATIENT_ID/appointments" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"data_hora\":\"$ORIG_ISO\"}")
echo "$APPT2"
APPT2_ID=$(echo "$APPT2" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).id))")

NOVO_ISO=$(node -e "console.log(new Date(Date.now()+96*60*60*1000).toISOString())")
echo "--- Remarcando para $NOVO_ISO ---"
curl -s -X POST "$BASE_URL/api/appointments/$APPT2_ID/reschedule" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"data_hora\":\"$NOVO_ISO\"}" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 10. Paciente tenta cancelar essa consulta remarcada (só ~4 dias de antecedência, > 24h mínimas: deve funcionar) ---"
curl -s -X POST "$BASE_URL/api/appointments/$APPT2_ID/cancel" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"ator":"paciente"}' -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 11. Consulta em 2h + paciente tenta cancelar (esperado: erro E-19, prazo mínimo de 24h não respeitado) ---"
SOON_ISO=$(node -e "console.log(new Date(Date.now()+2*60*60*1000).toISOString())")
APPT3=$(curl -s -X POST "$BASE_URL/api/patients/$PATIENT_ID/appointments" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"data_hora\":\"$SOON_ISO\"}")
APPT3_ID=$(echo "$APPT3" | node -e "process.stdin.on('data', d => console.log(JSON.parse(d).id))")
curl -s -X POST "$BASE_URL/api/appointments/$APPT3_ID/cancel" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"ator":"paciente"}' -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 12. Nutricionista cancela a mesma consulta em cima da hora (esperado: sucesso, sem restrição de antecedência) ---"
curl -s -X POST "$BASE_URL/api/appointments/$APPT3_ID/cancel" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"ator":"nutricionista"}' -w "\nSTATUS:%{http_code}\n"
