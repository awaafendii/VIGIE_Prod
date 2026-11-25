# VIGIE — Récapitulatif de mise en service (multi-tenant)

Vue consolidée des **migrations**, **endpoints**, **variables d'environnement** et de la **check-list de déploiement**. Le détail par phase et les tests d'acceptation A→H sont dans [`README.md`](./README.md).

> **Principe de non-régression** : tant que Supabase n'est pas configuré, l'application reste en **mode démonstration**, strictement inchangée. L'activation est pilotée par la présence des variables d'environnement (voir *Bascule démo → réel*).

---

## 1. Bascule démo → réel (feature flags)

| Déclencheur | Effet |
|---|---|
| **Front** : `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` présents | Écran de connexion activé avant `#/app` ; `session` transmise à l'app ; onglets réels (Partages, Connecteurs) et espace institution réel apparaissent. |
| **Serveur** : `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` présents (`configured()`) | Les routes `/api/*` cessent de répondre `501` et opèrent sur la base. |
| **Chiffrement** : `VIGIE_ENC_KEY` (32 o base64) présente | L'enregistrement d'un connecteur marchand est autorisé (sinon `501`). |
| Aucune de ces variables | **Mode démonstration** : aucun appel réseau, aucune fonctionnalité retirée. |

---

## 2. Migrations (ordre impératif)

Appliquer `0001` → `0008` (via `supabase db push` ou l'éditeur SQL Supabase).

| # | Fichier | Contenu |
|---|---|---|
| 0001 | `0001_identity.sql` | Schéma `app`, `profiles`, `organizations`, `organization_members`, trigger de profil |
| 0002 | `0002_identity_rls.sql` | Helpers `SECURITY DEFINER` (`my_org_ids`, `is_member`) + RLS d'isolation |
| 0003 | `0003_audit.sql` | `audit_logs` (traçabilité, écriture `service_role`) |
| 0004 | `0004_financial.sql` | `financial_accounts`, `integrations`, `import_batches`, `raw_transactions`, `transactions`, `settlements` + RLS PME ; idempotence transactions/import |
| 0005 | `0005_scoring_recommendations.sql` | `scoring_model_versions`, `credit_assessments`, `risk_indicators`, `recommendations`, `recommendation_events` + RLS |
| 0006 | `0006_consent.sql` | `data_access_grants`, `grant_events`, helper `has_grant` + policies additives (accès institution borné au consentement) |
| 0007 | `0007_integration_keys.sql` | `integrations.credentials_sealed` / `key_version` + **révocation du SELECT colonne** des secrets |
| 0008 | `0008_alerts.sql` | `credit_alerts` + RLS (membre **ou** consentement actif) |

---

## 3. Variables d'environnement

> **Secret** = jamais exposé au front, jamais préfixé `VITE_`, jamais commité. Les variables `VITE_*` sont publiques par conception.

### Front (publiques)
| Variable | Rôle |
|---|---|
| `VITE_API_BASE` | Base de l'API si backend distinct (vide = même origine `/api`) |
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé anon (publique ; la RLS protège les données) |

### Serveur
| Variable | Secret | Rôle |
|---|:--:|---|
| `SUPABASE_URL` | | URL du projet |
| `SUPABASE_ANON_KEY` | | Clé anon (client « au nom de l'utilisateur », RLS appliquée) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Contourne la RLS** — opérations système uniquement |
| `VIGIE_ENC_KEY` | ✅ | Clé maître AES-256-GCM (32 o base64) des secrets marchand |
| `VIGIE_ENC_KEY_VERSION` | | Version de la clé active (1..255, défaut 1) |
| `VIGIE_ENC_KEYS` | ✅ | Anciennes clés pour la rotation (`"1:base64,…"`) |
| `VIGIE_ROTATE_TOKEN` | ✅ | Jeton d'exploitation de `/api/admin/rotate-keys` (vide = endpoint 404) |
| `CINETPAY_APIKEY` | ✅ | Clé du marchand d'environnement (legacy mono-marchand) |
| `CINETPAY_SITE_ID` | | Site du marchand d'environnement |
| `CINETPAY_BASE` / `CINETPAY_HISTO_BASE` | | Bases d'API CinetPay (défauts corrects) |
| `CINETPAY_NOTIFY_TOKEN` | ✅ | Jeton du webhook de paiements (facultatif) |
| `SETTLEMENT_WEBHOOK_TOKEN` | ✅ | Jeton du webhook de versements (vide = endpoint 404) |
| `APP_ORIGIN` | | Origine exacte de l'app (anti-CSRF des connecteurs démo) |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ✅ | Store KV (stock « holding » des paiements non rattachés) |
| `SANDBOX_TOKEN` | ✅ | Endpoint de recette `/api/banque/diagnostic` (vide = 404) |
| `SESSION_SECRET` | ✅ | Réservé à un futur agrégateur OAuth |

Secrets à générer : `openssl rand -base64 32`.

---

## 4. Endpoints API

Toutes les routes applicatives authentifient par **JWT Supabase** (en-tête `Authorization: Bearer`) et vérifient **identité → appartenance → rôle** avant toute écriture. Non configuré → `501`.

### Identité
| Méthode | Route | Contrôle |
|---|---|---|
| GET | `/api/auth/session` | JWT → identité + organisations réelles (source de vérité des droits) |

### PME — finance
| Méthode | Route | Contrôle |
|---|---|---|
| POST | `/api/imports` | owner/finance_manager/accountant ; persiste (idempotent) + historise l'évaluation |
| GET | `/api/imports?orgId=` | membre (RLS) |
| GET | `/api/data/transactions?orgId=&mois=` | membre (RLS) |
| GET / POST | `/api/assessments` | GET membre ; POST recalcule (rôles écriture) |

### Partages & institution
| Méthode | Route | Contrôle |
|---|---|---|
| GET | `/api/institutions` | authentifié (annuaire des institutions) |
| GET | `/api/grants?orgId=` | membre (PME ou institution) |
| POST | `/api/grants` `{grant\|revoke}` | membre PME, owner/finance_manager |
| GET | `/api/institution/portfolio?institutionOrgId=` | membre institution ; PME consentantes + dernière éval + alerte |
| GET | `/api/institution/pme?institutionOrgId=&pmeOrgId=` | membre institution **+ consentement actif** (sinon 403) |
| GET / POST | `/api/recommendations` | parties concernées ; POST = rôle institution |

### Connecteurs, alertes, versements
| Méthode | Route | Contrôle |
|---|---|---|
| GET / POST | `/api/integrations` | membre PME ; POST owner/finance_manager ; secret chiffré, jamais renvoyé ; **409** si site déjà rattaché |
| GET / POST | `/api/alerts` | GET membre ou consentement ; POST `ack` = membre PME |
| GET / POST | `/api/settlements` | GET rapprochement (membre) ; POST `record`/`import` (rôles écriture) |

### Webhooks & exploitation
| Méthode | Route | Auth |
|---|---|---|
| POST | `/api/banque/notify` | Webhook paiements : re-vérifie via la clé du marchand (`cpm_site_id`) → attribue à son org ; sinon holding KV |
| POST | `/api/banque/settlement-notify` | Webhook versements : `x-settlement-token` ; 404 si non configuré |
| POST | `/api/admin/rotate-keys` | `x-rotate-token` ; re-scelle les secrets en version active ; 404 si non configuré |

### Connecteurs démo (hérités, mono-marchand)
`/api/banque/connexions`, `/api/banque/lien`, `/api/banque/transactions`, `/api/banque/diagnostic` — flux OAuth/KV de la démonstration, indépendants du multi-tenant.

---

## 5. Check-list de mise en service

1. **Projet Supabase** créé (PostgreSQL + Auth).
2. **Migrations** `0001` → `0008` appliquées dans l'ordre.
3. **Variables serveur** renseignées (Vercel › Settings) : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VIGIE_ENC_KEY` (+ `VIGIE_ENC_KEY_VERSION=1`). CinetPay/KV/webhooks selon usage.
4. **Variables front** : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
5. **Première organisation + membre** : inscrire les comptes (écran de connexion ou Supabase › Authentication), puis exécuter [`seed.sql`](./seed.sql) avec leurs UUID (`-v pme_user=… -v inst_user=…`).
6. **Déploiement** ; vérifier que l'écran de connexion s'active avant `#/app`.
7. **CinetPay** (si utilisé) : chaque PME connecte son compte dans *Connecteurs* ; déclarer `/api/banque/notify` comme `notify_url`.
8. **Versements** (si utilisé) : configurer `SETTLEMENT_WEBHOOK_TOKEN` et pointer le webhook, ou importer un relevé (`action:'import'`).
9. **Tests d'acceptation A→H** : `node supabase/tests/local-logic.mjs` (logique pure, hors ligne) puis `bash supabase/tests/acceptance.sh` (bout en bout ; exporter `BASE`, `JWT_PME`, `JWT_INST`, `ORG_PME`, `ORG_INST`, et selon les cas `ROTATE_TOKEN`/`SETTLEMENT_TOKEN`). Détail des cas dans [`README.md`](./README.md).
10. **Exploitation** : sauvegardes Supabase (PITR), supervision des `audit_logs`, procédure de **rotation de clé** (README § *Rotation*).

---

## 6. Invariants de sécurité (rappels)

- Aucun changement d'« espace » côté React n'autorise quoi que ce soit : tout contrôle est **serveur + RLS**.
- Une institution ne voit une PME **que** via un consentement actif, daté, révocable.
- Secrets (`service_role`, `VIGIE_ENC_KEY`, apikey CinetPay, jetons de webhook) : **serveur uniquement**, jamais `VITE_`, jamais commités. Clé marchand **chiffrée au repos**, jamais renvoyée, colonne non lisible hors `service_role`.
- Paiements/versements : **jamais** d'attribution non vérifiée ou d'un site non rattaché à une PME.
- Idempotence : transactions, imports, versements. Évaluations **versionnées et historisées**.
- Données de démonstration (`genererPortefeuille`) strictement séparées des données réelles.

> **État des tests** : tous les fichiers passent `node --check` (backend) et `npm run build` (front) ; les logiques pures (anomalies, alertes, chiffrement/rotation, rapprochement) sont vérifiées en local. Les tests A→H nécessitant un projet Supabase réel **n'ont pas été exécutés** dans ce dépôt.
