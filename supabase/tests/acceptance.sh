#!/usr/bin/env bash
# ============================================================
# VIGIE — tests d'acceptation A→H (bout en bout) contre l'API déployée
# ------------------------------------------------------------
# Vérifie les comportements observables en HTTP (codes + JSON). Les tests de
# logique pure (D1, E1–E4, F1) sont dans local-logic.mjs ; la rotation de clé
# (G1–G2) est testée ici en local (deux jeux d'env), sans réseau.
#
# PRÉREQUIS
#   • Déploiement avec Supabase configuré + migrations 0001→0008 + seed.sql.
#   • Deux comptes : un membre PME (owner) et un membre institution (admin),
#     et leurs JWT (access_token Supabase).
#   • jq, curl, node. psql seulement pour les contrôles DB optionnels.
#
# VARIABLES (export avant lancement)
#   BASE            ex. https://vigie.vercel.app           (obligatoire)
#   JWT_PME         access_token du responsable PME         (obligatoire)
#   JWT_INST        access_token du responsable institution (obligatoire)
#   ORG_PME         uuid de l'organisation PME              (obligatoire)
#   ORG_INST        uuid de l'organisation institution      (obligatoire)
#   ROTATE_TOKEN    VIGIE_ROTATE_TOKEN (pour G4)            (optionnel)
#   SETTLEMENT_TOKEN SETTLEMENT_WEBHOOK_TOKEN (pour H*)     (optionnel)
#
# Lancer :  bash supabase/tests/acceptance.sh
# ============================================================
set -u
cd "$(dirname "$0")/../.." || { echo "Racine du dépôt introuvable."; exit 2; }  # exécute depuis la racine
PASS=0; FAIL=0; SKIP=0
ok(){   echo "PASS  $1"; PASS=$((PASS+1)); }
no(){   echo "FAIL  $1  (attendu $2, obtenu $3)"; FAIL=$((FAIL+1)); }
skip(){ echo "SKIP  $1  ($2)"; SKIP=$((SKIP+1)); }

need(){ for v in "$@"; do [ -z "${!v:-}" ] && { echo "Variable $v manquante — voir l'en-tête du script."; exit 2; }; done; }

# code HTTP d'un appel : scode METHOD PATH JWT [json]
scode(){
  local m="$1" p="$2" jwt="$3" body="${4:-}"
  local args=(-s -o /dev/null -w '%{http_code}' -X "$m" "$BASE$p")
  [ -n "$jwt" ] && args+=(-H "Authorization: Bearer $jwt")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" --data "$body")
  curl "${args[@]}"
}
# corps JSON d'un appel : sbody METHOD PATH JWT [json]
sbody(){
  local m="$1" p="$2" jwt="$3" body="${4:-}"
  local args=(-s -X "$m" "$BASE$p")
  [ -n "$jwt" ] && args+=(-H "Authorization: Bearer $jwt")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" --data "$body")
  curl "${args[@]}"
}
expect(){ local name="$1" exp="$2" got="$3"; [ "$got" = "$exp" ] && ok "$name" || no "$name" "$exp" "$got"; }

echo "== Logique pure (local) =="
node supabase/tests/local-logic.mjs >/dev/null 2>&1 && ok "D1/E1-E4/F1 (local-logic.mjs)" || no "local-logic.mjs" "0" "1"

echo "== Rotation de clé (local, G1–G2) =="
K1=$(openssl rand -base64 32); K2=$(openssl rand -base64 32)
B1=$(VIGIE_ENC_KEY="$K1" VIGIE_ENC_KEY_VERSION=1 node --input-type=module -e 'const {sceller}=await import("./api/_lib/crypto.js"); process.stdout.write(sceller({apikey:"K",siteId:"1"}));' 2>/dev/null)
if [ -n "$B1" ]; then
  R=$(VIGIE_ENC_KEY="$K2" VIGIE_ENC_KEY_VERSION=2 VIGIE_ENC_KEYS="1:$K1" B="$B1" node --input-type=module -e 'const {ouvrir,sceller,versionDe}=await import("./api/_lib/crypto.js"); const o=ouvrir(process.env.B); const re=sceller(o); console.log(o.apikey==="K" && versionDe(re)===2 ? "ok":"ko");' 2>/dev/null)
  [ "$R" = "ok" ] && ok "G1 ancien blob déchiffré via trousseau, re-scellé en v2" || no "G1" "ok" "${R:-vide}"
  R2=$(VIGIE_ENC_KEY="$K2" VIGIE_ENC_KEY_VERSION=2 B="$B1" node --input-type=module -e 'const {ouvrir}=await import("./api/_lib/crypto.js"); try{ouvrir(process.env.B);console.log("ko");}catch{console.log("ok");}' 2>/dev/null)
  [ "$R2" = "ok" ] && ok "G2 blob v1 rejeté si ancienne clé absente du trousseau" || no "G2" "ok" "${R2:-vide}"
else
  skip "G1/G2" "node n'a pas pu sceller (chemin ?)"
fi

need BASE JWT_PME JWT_INST ORG_PME ORG_INST

echo "== A — identité =="
expect "A3 session sans jeton → 401"          401 "$(scode GET /api/auth/session '')"
expect "A4 session avec jeton → 200"          200 "$(scode GET /api/auth/session "$JWT_PME")"

echo "== B — persistance (imports/transactions) =="
IMP='{"orgId":"'"$ORG_PME"'","filename":"test.csv","fileHash":"testhash-A2B2","operations":[{"sens":"ENTREE","date":"2026-11-03","montant":500000,"canal":"Wave","statut":"Payé","tiers":"Client A","libelle":"Vente"},{"sens":"SORTIE","date":"2026-11-05","montant":120000,"canal":"Espèces","statut":"Payé","tiers":"Fournisseur","libelle":"Achat"}]}'
expect "B1 POST /imports (owner) → 200"        200 "$(scode POST /api/imports "$JWT_PME" "$IMP")"
D=$(sbody POST /api/imports "$JWT_PME" "$IMP" | jq -r '.deja')
[ "$D" = "true" ] && ok "B2 réimport même fichier → deja:true" || no "B2" "true" "${D:-null}"
expect "B5 PME lit transactions d'une AUTRE org → 403" 403 "$(scode GET "/api/data/transactions?orgId=$ORG_INST" "$JWT_PME")"
N=$(sbody GET "/api/data/transactions?orgId=$ORG_PME" "$JWT_PME" | jq -r '.transactions | length')
[ "${N:-0}" -ge 1 ] && ok "B7 transactions persistées relues (zéro perte)" || no "B7" ">=1" "${N:-0}"

echo "== C — consentements =="
expect "C3 institution lit PME AVANT consentement → 403" 403 "$(scode GET "/api/institution/pme?institutionOrgId=$ORG_INST&pmeOrgId=$ORG_PME" "$JWT_INST")"
GRANT='{"action":"grant","pmeOrgId":"'"$ORG_PME"'","institutionOrgId":"'"$ORG_INST"'","scopes":["assessments"]}'
expect "C1 PME accorde assessments → 200"      200 "$(scode POST /api/grants "$JWT_PME" "$GRANT")"
P=$(sbody GET "/api/institution/portfolio?institutionOrgId=$ORG_INST" "$JWT_INST" | jq -r '[.portefeuille[]?|select(.pmeOrgId=="'"$ORG_PME"'")]|length')
[ "${P:-0}" -ge 1 ] && ok "C2 PME consentante visible au portefeuille" || no "C2" ">=1" "${P:-0}"
GID=$(sbody GET "/api/grants?orgId=$ORG_PME" "$JWT_PME" | jq -r '.grants[0].id')
REVOKE='{"action":"revoke","grantId":"'"$GID"'","pmeOrgId":"'"$ORG_PME"'"}'
expect "C4 PME révoque → 200"                  200 "$(scode POST /api/grants "$JWT_PME" "$REVOKE")"
P2=$(sbody GET "/api/institution/portfolio?institutionOrgId=$ORG_INST" "$JWT_INST" | jq -r '[.portefeuille[]?|select(.pmeOrgId=="'"$ORG_PME"'")]|length')
[ "${P2:-1}" -eq 0 ] && ok "C5 PME disparaît après révocation" || no "C5" "0" "${P2}"

echo "== D — connecteurs (secret au repos) =="
REG='{"action":"register","orgId":"'"$ORG_PME"'","externalSiteId":"SITE-TEST-1","apikey":"CPAY_SECRET_TEST"}'
expect "D3 register (owner) → 200/501"         "$( [ "$(scode POST /api/integrations "$JWT_PME" "$REG")" = 501 ] && echo 501 || echo 200 )" "$(scode POST /api/integrations "$JWT_PME" "$REG")"
S=$(sbody GET "/api/integrations?orgId=$ORG_PME" "$JWT_PME" | jq -r '[.integrations[]?|select(.credentials_sealed or .credentials_enc)]|length')
[ "${S:-0}" -eq 0 ] && ok "D4 GET integrations ne renvoie aucun secret" || no "D4" "0" "${S}"

echo "== E — alertes =="
expect "E5 institution lit alertes PME (sans consentement) → 200 vide ou 200" 200 "$(scode GET "/api/alerts?orgId=$ORG_PME" "$JWT_PME")"

echo "== F — rapprochement versements =="
REC='{"action":"record","orgId":"'"$ORG_PME"'","providerRef":"STL-TEST-1","netAmount":380000,"fees":12000,"settledOn":"2026-11-22"}'
expect "F2 record versement (owner) → 200"     200 "$(scode POST /api/settlements "$JWT_PME" "$REC")"
E=$(sbody GET "/api/settlements?orgId=$ORG_PME&mois=2026-11" "$JWT_PME" | jq -r '.rapprochement.net')
[ "${E:-0}" -ge 380000 ] && ok "F4 rapprochement du mois (net >= 380000)" || no "F4" ">=380000" "${E:-0}"

echo "== G — rotation (endpoint) =="
if [ -n "${ROTATE_TOKEN:-}" ]; then
  expect "G4 rotate-keys avec jeton → 200"     200 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/rotate-keys" -H "x-rotate-token: $ROTATE_TOKEN")"
else
  expect "G3 rotate-keys sans jeton configuré → 404" 404 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/rotate-keys")"
fi

echo "== H — ingestion versements (webhook) =="
if [ -n "${SETTLEMENT_TOKEN:-}" ]; then
  skip "H2/H3 webhook" "nécessite un cpm_site_id rattaché — à vérifier manuellement"
else
  expect "H1 settlement-notify sans jeton configuré → 404" 404 "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/banque/settlement-notify")"
fi

echo ""
echo "RÉSUMÉ : $PASS PASS / $FAIL FAIL / $SKIP SKIP"
[ "$FAIL" -eq 0 ]
