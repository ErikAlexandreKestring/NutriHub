#!/bin/bash
# Demonstração ponta a ponta do login de paciente — RF-02, e o efeito dele sobre
# RF-03 (isolamento de papéis) e RF-11 (RN-10 agora inescapável).
# Requer o servidor rodando em outro terminal (npm run dev).
set -e

BASE_URL="http://localhost:3000"
SUFFIX=$(date +%s)
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log($1)})"; }

echo "--- 1. Nutricionista A cadastra um paciente ---"
NUTRI_A=$(curl -s -X POST "$BASE_URL/api/auth/register" -H "Content-Type: application/json" \
  -d "{\"nome\":\"Nutri A\",\"email\":\"nutriA$SUFFIX@nutrihub.com\",\"crn\":\"CRN-3 1$SUFFIX\",\"senha\":\"SenhaForte123\"}")
TOKEN_A=$(echo "$NUTRI_A" | json "o.token")

P1=$(curl -s -X POST "$BASE_URL/api/patients" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"nome\":\"Paciente Um\",\"email\":\"p1_$SUFFIX@nutrihub.com\",\"data_nascimento\":\"1995-03-10\"}")
P1_ID=$(echo "$P1" | json "o.id")

P2=$(curl -s -X POST "$BASE_URL/api/patients" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"nome\":\"Paciente Dois\",\"email\":\"p2_$SUFFIX@nutrihub.com\",\"data_nascimento\":\"1990-01-05\"}")
P2_ID=$(echo "$P2" | json "o.id")
echo "P1=$P1_ID P2=$P2_ID (mesmo tenant)"

echo ""
echo "--- 2. Login do paciente ANTES do primeiro acesso (esperado: 401) ---"
curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"p1_$SUFFIX@nutrihub.com\",\"senha\":\"SenhaDoPaciente1\"}" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 3. Nutricionista gera o token de primeiro acesso (RF-02) ---"
ACCESS=$(curl -s -X POST "$BASE_URL/api/patients/$P1_ID/access-token" -H "Authorization: Bearer $TOKEN_A")
echo "$ACCESS"
ACCESS_TOKEN=$(echo "$ACCESS" | json "o.token")

echo ""
echo "--- 4. Paciente define a senha e já recebe o JWT (24h) ---"
SETPWD=$(curl -s -X POST "$BASE_URL/api/auth/patient/definir-senha" -H "Content-Type: application/json" \
  -d "{\"token\":\"$ACCESS_TOKEN\",\"senha\":\"SenhaDoPaciente1\"}")
echo "$SETPWD"
TOKEN_P1=$(echo "$SETPWD" | json "o.token")
echo "$TOKEN_P1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(Buffer.from(s.trim().split('.')[1],'base64url'));console.log('payload:',JSON.stringify(p),'| validade(h):',((p.exp-p.iat)/3600))})"

echo ""
echo "--- 5. Reutilizar o mesmo token de primeiro acesso (esperado: 400, token consumido) ---"
curl -s -X POST "$BASE_URL/api/auth/patient/definir-senha" -H "Content-Type: application/json" \
  -d "{\"token\":\"$ACCESS_TOKEN\",\"senha\":\"OutraSenha123\"}" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 6. Login normal do paciente pelo /api/auth/login (esperado: 200, role=paciente) ---"
LOGIN_P1=$(curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"p1_$SUFFIX@nutrihub.com\",\"senha\":\"SenhaDoPaciente1\"}")
echo "$LOGIN_P1"
TOKEN_P1=$(echo "$LOGIN_P1" | json "o.token")

echo ""
echo "--- 7. Paciente tenta listar TODOS os pacientes do consultório (esperado: 403) ---"
curl -s "$BASE_URL/api/patients" -H "Authorization: Bearer $TOKEN_P1" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 8. Paciente tenta ver a agenda de OUTRO paciente do mesmo tenant (esperado: 403) ---"
curl -s "$BASE_URL/api/patients/$P2_ID/appointments" -H "Authorization: Bearer $TOKEN_P1" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 9. Paciente vê a própria agenda (esperado: 200) ---"
curl -s "$BASE_URL/api/patients/$P1_ID/appointments" -H "Authorization: Bearer $TOKEN_P1" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 10. Agendar uma consulta daqui a 2h (nutricionista cadastra a grade e agenda) ---"
SOON_ISO=$(node -e "console.log(new Date(Date.now()+2*60*60*1000).toISOString())")
DAY_OF_WEEK=$(node -e "console.log(new Date('$SOON_ISO').toLocaleString('en-US',{timeZone:'America/Sao_Paulo',weekday:'short'}))" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(({Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6})[s.trim()]))")
curl -s -X POST "$BASE_URL/api/availability" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"day_of_week\":$DAY_OF_WEEK,\"start_time\":\"00:00\",\"end_time\":\"23:59\"}" > /dev/null
APPT=$(curl -s -X POST "$BASE_URL/api/patients/$P1_ID/appointments" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"data_hora\":\"$SOON_ISO\"}")
echo "$APPT"
APPT_ID=$(echo "$APPT" | json "o.id")

echo ""
echo "--- 11. RN-10: paciente tenta cancelar com 2h de antecedência (esperado: 400 / E-19) ---"
echo "     Antes, com o ator vindo do body, bastava mandar ator=nutricionista para furar esta regra."
curl -s -X POST "$BASE_URL/api/appointments/$APPT_ID/cancel" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_P1" \
  -d "{\"ator\":\"nutricionista\"}" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 12. RN-10 na REMARCAÇÃO: paciente tenta remarcar a consulta de daqui a 2h (esperado: 400 / E-19) ---"
echo "     Remarcar libera o horário original igual a um cancelamento; sem esta checagem"
echo "     bastava remarcar em vez de cancelar para furar a RN-10."
LATER_ISO=$(node -e "console.log(new Date(Date.now()+96*60*60*1000).toISOString())")
curl -s -X POST "$BASE_URL/api/appointments/$APPT_ID/reschedule" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_P1" \
  -d "{\"data_hora\":\"$LATER_ISO\"}" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 13. O nutricionista, esse sim, cancela a qualquer momento (esperado: 200) ---"
curl -s -X POST "$BASE_URL/api/appointments/$APPT_ID/cancel" -H "Authorization: Bearer $TOKEN_A" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "--- 14. E-mail que é de um NUTRICIONISTA e também de um paciente de outro consultório ---"
echo "     Antes, o login parava na tabela de tenants e o paciente nunca era consultado:"
echo "     o dono do e-mail ficava permanentemente sem conseguir entrar."
COLIDE="colide$SUFFIX@nutrihub.com"
curl -s -X POST "$BASE_URL/api/auth/register" -H "Content-Type: application/json" \
  -d "{\"nome\":\"Nutri B\",\"email\":\"$COLIDE\",\"crn\":\"CRN-3 2$SUFFIX\",\"senha\":\"SenhaDoNutriB1\"}" > /dev/null

P3=$(curl -s -X POST "$BASE_URL/api/patients" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN_A" \
  -d "{\"nome\":\"Paciente Tres\",\"email\":\"$COLIDE\",\"data_nascimento\":\"1988-07-22\"}")
P3_ID=$(echo "$P3" | json "o.id")
ACCESS_3=$(curl -s -X POST "$BASE_URL/api/patients/$P3_ID/access-token" -H "Authorization: Bearer $TOKEN_A" | json "o.token")
curl -s -X POST "$BASE_URL/api/auth/patient/definir-senha" -H "Content-Type: application/json" \
  -d "{\"token\":\"$ACCESS_3\",\"senha\":\"SenhaDoPaciente3\"}" > /dev/null

echo "  a) login com a senha do PACIENTE (esperado: 200, role=paciente)"
curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$COLIDE\",\"senha\":\"SenhaDoPaciente3\"}" -w "\nSTATUS:%{http_code}\n"

echo ""
echo "  b) login com a senha do NUTRICIONISTA (esperado: 200, role=nutricionista)"
curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$COLIDE\",\"senha\":\"SenhaDoNutriB1\"}" -w "\nSTATUS:%{http_code}\n"
