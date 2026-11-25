# VIGIE — Backend de rapprochement via CinetPay (fonctions Vercel)

Ces fonctions serverless permettent au rapprochement bancaire de lire les
**encaissements réels** encaissés via **CinetPay** (Orange Money, Wave, MTN, Moov…),
sans jamais exposer de secret au navigateur.

## Modèle CinetPay (important)

CinetPay **n'expose pas d'API de liste de transactions** : l'historique est dans le
back-office. La façon fiable de reconstituer les encaissements pour le rapprochement
est donc :

1. À chaque paiement, CinetPay appelle votre **webhook** `notify_url`.
2. Le webhook **re-vérifie** le paiement auprès de CinetPay (`/v2/payment/check`,
   avec l'`apikey` serveur) — un POST falsifié ne peut donc pas forger un encaissement.
3. La transaction vérifiée est **enregistrée** dans un magasin (Vercel KV).
4. L'application lit le **stock du mois** pour le rapprocher de la comptabilité.

> À l'initialisation de vos paiements CinetPay, renseignez
> `notify_url = https://VOTRE-DOMAINE/api/banque/notify`.

## Endpoints

| Méthode | Route | Rôle |
|--------|-------|------|
| `GET`    | `/api/banque/connexions` | Disponibilité (200 si configuré) |
| `DELETE` | `/api/banque/connexions?fournisseur=X` | Oublie une source (marqueur client) |
| `POST`   | `/api/banque/lien` | Confirme la source → `{ mode: "direct" }` |
| `POST`   | `/api/banque/notify` | **Webhook CinetPay** (vérifie + stocke) |
| `GET`    | `/api/banque/transactions?fournisseur=X&mois=AAAA-MM` | Encaissements du mois |

Tant que les variables d'environnement ne sont pas configurées, les endpoints
répondent `501 { erreur: "non_configure" }` et l'application affiche
« connexion non activée » (aucune donnée inventée).

## Mise en service

1. **Compte marchand CinetPay** : récupérez `APIKEY` et `SITE_ID` dans le back-office.
2. **Variables d'environnement** (cf. `.env.example`) dans **Vercel › Settings › Environment Variables** :
   `CINETPAY_APIKEY`, `CINETPAY_SITE_ID`, `APP_ORIGIN`.
3. **Stockage** : créez un store **Vercel KV**, liez-le au projet (variables
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` injectées), puis `npm i @vercel/kv`.
4. **Webhook** : déclarez `notify_url = https://VOTRE-DOMAINE/api/banque/notify`
   dans l'initialisation de vos paiements CinetPay.
5. Déployez. Les fonctions sont servies automatiquement sous `/api/*`.

## Tester le flux sans vrai paiement (sandbox)

L'endpoint `/api/banque/diagnostic` valide la configuration et permet d'injecter
des transactions de **test** (préfixées `TEST-`). Il est **désactivé par défaut** :
définissez `SANDBOX_TOKEN` (en recette uniquement) et envoyez-le dans l'en-tête
`x-sandbox-token`. Laissez-le vide en production (l'endpoint renvoie alors 404).

```bash
TOKEN="votre-sandbox-token"
BASE="https://VOTRE-DOMAINE"

# 1) État : config CinetPay présente ? Vercel KV joignable (kvRoundtrip:true) ?
curl -s "$BASE/api/banque/diagnostic" -H "x-sandbox-token: $TOKEN"

# 2) Injecter un encaissement de test (visible dans le rapprochement du mois)
curl -s -X POST "$BASE/api/banque/diagnostic" \
  -H "x-sandbox-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"montant":250000,"canal":"Wave","libelle":"Test Wave"}'

# 3) Dans l'app (#/app) : Rapprochement → « Connecter en sécurité » (Wave)
#    → la transaction de test apparaît et se rapproche de la comptabilité.

# 4) Nettoyer les transactions de test du mois
curl -s -X DELETE "$BASE/api/banque/diagnostic?mois=$(date +%Y-%m)" \
  -H "x-sandbox-token: $TOKEN"
```

Quand `diagnostic` renvoie `configure:true` et `kvRoundtrip:true`, le câblage est bon :
il ne reste qu'à déclarer le `notify_url` chez CinetPay pour recevoir les vrais paiements.

## Points de vigilance

- Sans Vercel KV, le webhook n'a nulle part où écrire → l'écran reste « non activée ».
  Pour un autre stockage (Postgres/Mongo), ré-implémentez `enregistrer()` / `listerMois()`
  dans [`_lib/magasin.js`](./_lib/magasin.js).
- Vérifiez les noms de champs du webhook (`cpm_trans_id` / `transaction_id`) et de la
  réponse `/payment/check` sur la **doc CinetPay à jour** — ils varient selon la version.
- Pour les comptes **bancaires** classiques (hors mobile money), l'import de fichier
  reste le complément : l'open banking n'est pas encore mûr en zone UEMOA.
- Durcissement production : rate limiting sur `/api/banque/*`, journalisation,
  et restriction du `connect-src` (CSP dans `vercel.json`) au domaine CinetPay.

Réf : [docs.cinetpay.com — vérification](https://docs.cinetpay.com/api/1.0-fr/checkout/verification) ·
[notification (webhook)](https://docs.cinetpay.com/api/1.0-fr/checkout/notification)
