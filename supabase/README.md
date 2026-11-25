# VIGIE — Phase 1 : Infrastructure & identité

> 📋 **Mise en service** : voir [`DEPLOIEMENT.md`](./DEPLOIEMENT.md) — récapitulatif consolidé (migrations, endpoints, variables d'environnement, check-list).


Socle multi-tenant : **identité** (Supabase Auth), **organisations** (PME / institution / admin), **appartenance + rôles**, et **isolation par RLS**. Conçu pour ne **rien casser** : tant que Supabase n'est pas configuré, l'application reste en mode démonstration.

## Contenu

| Fichier | Rôle |
|---|---|
| `migrations/0001_identity.sql` | Schéma `app`, enums, `profiles`, `organizations`, `organization_members`, trigger de profil |
| `migrations/0002_identity_rls.sql` | Helpers `SECURITY DEFINER` + activation RLS + politiques d'isolation |
| `migrations/0003_audit.sql` | `audit_logs` (traçabilité ; écriture via `service_role`) |

Côté application : `api/_lib/db.js` (clients admin / utilisateur), `api/_lib/auth.js` (identité, appartenance, audit), `api/auth/session.js` (contexte serveur), `src/auth.js` + `src/Auth.jsx` (connexion navigateur, activée par variables d'env).

## Mise en service

1. Créer un projet **Supabase** (PostgreSQL + Auth).
2. Appliquer les migrations **dans l'ordre** (par `supabase db push`, ou en collant le SQL dans l'éditeur Supabase) : `0001` → `0002` → `0003`.
3. Renseigner les variables d'environnement (cf. `.env.example`) :
   - **Front** (publiques) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
   - **Serveur** (Vercel › Settings) : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   - ⚠️ `SUPABASE_SERVICE_ROLE_KEY` contourne la RLS : **jamais** côté front, **jamais** préfixée `VITE_`.
4. Déployer. Dès que les deux variables `VITE_SUPABASE_*` sont présentes, l'écran de connexion s'active avant `#/app`.

### Créer une première organisation (exemple, à exécuter côté serveur)
```sql
-- après qu'un utilisateur se soit inscrit (il existe dans auth.users / app.profiles)
insert into app.organizations (type, name, slug, created_by)
values ('PME', 'NPM Multiservices', 'npm', '<auth-user-uuid>')
returning id;

insert into app.organization_members (org_id, user_id, role)
values ('<org-id>', '<auth-user-uuid>', 'owner');
```

## Limites assumées de la Phase 1
- **Identité et périmètre** sont réels (login + résolution serveur des organisations/rôles).
- La **consommation** du périmètre par l'interface (choisir PME vs institution d'après les organisations réelles, et isoler les données financières) relève des **Phases 2–3**. En Phase 1, l'app affiche encore ses données de démonstration **derrière** l'authentification.
- Le portefeuille fictif (`genererPortefeuille`) n'est pas encore déplacé dans une organisation `is_demo` — prévu Phase 3.

## Tests d'acceptation Phase 1 (à exécuter sur un projet Supabase de test)

| # | Test | Attendu |
|---|---|---|
| A1 | Accès à `#/app` sans session (auth configurée) | Écran de connexion, pas d'application |
| A2 | Connexion avec identifiants valides | Accès à l'application + chip email/déconnexion |
| A3 | `GET /api/auth/session` sans jeton | `401` |
| A4 | `GET /api/auth/session` avec jeton valide | `200` + organisations réelles de l'utilisateur |
| A5 | RLS : utilisateur A lit `app.organization_members` | Ne voit **que** ses propres liens / co-membres |
| A6 | RLS : requête directe (client anon) sur `organizations` d'une autre org | **0 ligne** (sauf `is_demo`) |
| A7 | Aucune variable Supabase | Application **inchangée** (mode démo), pas d'écran de connexion |
| A8 | `service_role` jamais exposée | Absente du bundle front (`dist/`) et des variables `VITE_` |

> Ces tests nécessitent un projet Supabase réel : ils n'ont pas été exécutés dans ce dépôt. Les fichiers livrés passent `node --check` (backend) et `npm run build` (front).

---

# Phase 2 — Persistance financière

Imports, transactions, comptes, intégrations, évaluations et recommandations **durables**. L'évaluation officielle est **recalculée côté serveur** (réutilise `src/analyse.js`) ; le navigateur ne fournit qu'une prévisualisation.

## Migrations ajoutées
| Fichier | Rôle |
|---|---|
| `migrations/0004_financial.sql` | `financial_accounts`, `integrations`, `import_batches`, `raw_transactions`, `transactions`, `settlements` + RLS PME-only. Idempotence : `UNIQUE(org_id,source,source_ref)` et `UNIQUE(org_id,file_hash)` |
| `migrations/0005_scoring_recommendations.sql` | `scoring_model_versions`, `credit_assessments`, `risk_indicators`, `recommendations`, `recommendation_events` + RLS |

Appliquer dans l'ordre après `0003` : `0004` → `0005`.

## Routes API ajoutées
| Méthode | Route | Rôle / contrôle |
|---|---|---|
| POST | `/api/imports` | Persiste un import (idempotent) + historise l'évaluation. Rôles PME : owner/finance_manager/accountant |
| GET | `/api/imports?orgId=` | Liste les lots d'import (RLS) |
| GET | `/api/data/transactions?orgId=&mois=` | Transactions persistées (RLS), forme `analyse.js` |
| GET | `/api/assessments?orgId=` | Historique des évaluations (RLS) |
| POST | `/api/assessments` | Recalcule et historise l'évaluation officielle |
| GET | `/api/recommendations?orgId=` | Recommandations où l'org est PME ou institution |
| POST | `/api/recommendations` | Émet une recommandation (rôle institution requis) |

Client front : `src/finance.js` (`empreinteFichier`, `enregistrerImport`, `lireTransactions`, `historiqueEvaluations`, `recalculerEvaluation`, `listerRecommandations`, `envoyerRecommandation`).

## Tests d'acceptation Phase 2
| # | Test | Attendu |
|---|---|---|
| B1 | POST `/api/imports` avec opérations valides | Lot créé, transactions insérées, évaluation historisée |
| B2 | Réimport du **même fichier** (même `fileHash`) | `deja:true`, aucune nouvelle ligne |
| B3 | Réimport d'opérations identiques (hash différent) | Lignes en doublon **ignorées** (`UNIQUE(org_id,source,source_ref)`) |
| B4 | Deux évaluations successives | **Deux lignes** `credit_assessments` conservées (versionnées) |
| B5 | PME A lit `/api/data/transactions?orgId=<B>` | `403` (non membre de B) |
| B6 | Membre rôle `viewer` tente POST `/api/imports` | `403` (rôle insuffisant) |
| B7 | GET après rechargement | Transactions/évaluations **toujours présentes** (zéro perte) |

> Non exécutés ici (projet Supabase requis). Tous les fichiers passent `node --check` et `npm run build`.

## Branchement front (`App.jsx`)
`App.jsx` est désormais câblé sur `src/finance.js` :
- **Au montage** (authentifié + organisation PME) : `lireTransactions(orgId)` restaure les transactions persistées ; l'écran est reconstitué via une branche dédiée de `resultat` (opérations déjà normalisées → analyse directe). Un seul appel par organisation, sans écraser un import en cours.
- **À l'import d'un vrai fichier** mené à son terme (étape 3) : `enregistrerImport` envoie `POST /api/imports` (empreinte SHA-256 → idempotence). Les **exemples** intégrés (sans empreinte) ne sont **jamais** persistés, pour ne pas polluer l'espace réel d'une PME.
- Retour discret à l'écran (`PersistBadge`) : *restauré* / *enregistré* / *déjà enregistré* / *différé*.

En mode démo (sans Supabase) `session` est absente → `persistance = false` → aucun appel réseau, application **strictement inchangée**.

### Test manuel du zéro-perte (projet Supabase requis)
Se connecter → importer un fichier → **recharger la page** : les transactions et l'analyse réapparaissent sans réimport (test B7, bout-en-bout).

---

# Phase 3 — Consentements de partage & CinetPay multi-marchand

Partage **explicite** PME → institution (granulaire, daté, révocable), accès institution **borné au consentement**, et attribution **multi-marchand** des paiements CinetPay sans jamais rattacher arbitrairement l'historique à une PME.

## Migration ajoutée
| Fichier | Rôle |
|---|---|
| `migrations/0006_consent.sql` | `data_access_grants` (scopes `text[]`, `status`, `expires_at`, `revoked_at`), `grant_events` (historique), helper RLS `app.has_grant(pme, scope)`, policies **additives** autorisant une institution à lire `credit_assessments`/`risk_indicators`/`transactions` d'une PME **uniquement via un consentement actif** |

Appliquer dans l'ordre après `0005` : `0006`.

## Routes API ajoutées
| Méthode | Route | Rôle / contrôle |
|---|---|---|
| GET | `/api/grants?orgId=` | Consentements où l'org est PME **ou** institution (RLS) |
| POST | `/api/grants` `{action:'grant'}` | Une PME accorde/met à jour un partage. Rôles PME : owner/finance_manager |
| POST | `/api/grants` `{action:'revoke'}` | Une PME révoque un de ses partages |
| GET | `/api/institution/portfolio?institutionOrgId=` | PME ayant consenti à l'institution + dernière évaluation (**remplace** le portefeuille synthétique) |
| GET | `/api/institution/pme?institutionOrgId=&pmeOrgId=` | Évaluations + indicateurs d'une PME, **403 sans consentement actif** |

Client front : `src/consent.js` (`listerAutorisations`, `accorderAcces`, `revoquerAcces`, `portefeuilleInstitution`, `pmeAutorisee`).

### CinetPay multi-marchand
`api/banque/notify.js` + `api/_lib/cinetpay.js` : un paiement vérifié est attribué à l'organisation dont `app.integrations.external_site_id = cpm_site_id`. **Aucun rattachement → stock « holding » (KV) non attribué.** La vérification par marchand exige la clé du marchand : **activée en Phase 4** (clé chiffrée au repos, voir plus bas). Sans clé par marchand déchiffrable, un site non rattaché reste **ignoré proprement** (jamais attribué non vérifié).

## Tests d'acceptation Phase 3
| # | Test | Attendu |
|---|---|---|
| C1 | PME accorde `assessments` à une institution | Consentement actif + `grant_events` = 'granted' |
| C2 | Institution lit `/api/institution/portfolio` | La PME consentante apparaît avec sa dernière évaluation |
| C3 | Institution lit `/api/institution/pme` **avant** tout consentement | `403` (consentement) |
| C4 | PME révoque le partage | Statut 'revoked', `grant_events` = 'revoked' |
| C5 | Institution relit le portefeuille après révocation | La PME **disparaît** |
| C6 | Consentement avec `expiresAt` passé | PME absente du portefeuille (expiré) |
| C7 | Membre PME rôle `viewer` tente `POST /api/grants` | `403` (rôle insuffisant) |
| C8 | Webhook CinetPay, `cpm_site_id` rattaché à une intégration | Encaissement vérifié persisté dans l'org propriétaire (idempotent) ; site inconnu → holding, **non** attribué |

> Non exécutés ici (projet Supabase requis). Tous les fichiers passent `node --check` et `npm run build`.

## Branchement front (Phase 3)
`App.jsx` est câblé sur `src/consent.js` :
- **Écran PME « Partages »** (onglet visible seulement en compte réel avec une org PME) : annuaire des institutions (`GET /api/institutions`), formulaire d'octroi (scopes + échéance + note), liste des partages avec révocation. Le formulaire d'octroi/révocation n'est actif que pour les rôles `owner`/`finance_manager` (contrôlé aussi côté serveur).
- **Espace institution réel** : dès qu'une org INSTITUTION est rattachée au compte, l'espace affiche `portefeuilleInstitution` (PME réellement consentantes + dernière évaluation) au lieu du portefeuille fictif. L'ouverture d'une PME appelle `pmeAutorisee` → historique d'évaluations + signaux, **403 si le consentement n'est plus actif**.
- **Aucune donnée inventée** : l'espace réel n'affiche que ce que l'évaluation expose (score, état, période, instantané) — pas d'EAD/DPD/historique synthétiques. `genererPortefeuille` reste strictement cantonné à la **démonstration** (compte non authentifié).

En mode démo (sans Supabase), `session` est absente → `compteReel = false` → l'espace institution et l'onglet Partages restent exactement ceux de la démonstration, **inchangés**.

Endpoint ajouté : `GET /api/institutions` (annuaire des institutions, authentifié, non sensible).

### Test manuel bout-en-bout (projet Supabase requis)
PME → onglet Partages → accorder `assessments` à une institution ; se connecter comme membre de cette institution → la PME apparaît au portefeuille avec sa dernière évaluation ; PME révoque → la PME disparaît du portefeuille (tests C1–C5).

---

# Phase 4 — Vérification CinetPay par marchand (secrets chiffrés au repos)

Chaque PME connecte **son propre** compte marchand CinetPay. Sa clé API est **chiffrée au repos** (AES-256-GCM) et sert à **vérifier** ses paiements avant attribution. Le webhook devient réellement multi-marchand ; aucun paiement non vérifié n'est jamais attribué.

## Variable d'environnement (serveur uniquement)
`VIGIE_ENC_KEY` — clé maître AES-256-GCM, 32 octets en base64 (`openssl rand -base64 32`). **Jamais** `VITE_`, **jamais** commitée. Sans elle, l'enregistrement d'un connecteur est refusé (501) — aucun secret n'est stocké en clair.

## Migration ajoutée
| Fichier | Rôle |
|---|---|
| `migrations/0007_integration_keys.sql` | `integrations.credentials_sealed` (blob scellé base64), `key_version`, `credentials_added_at` ; **révocation du SELECT colonne** des secrets pour `authenticated`/`anon` (défense en profondeur) |

Appliquer dans l'ordre après `0006` : `0007`.

## Composants ajoutés
| Fichier | Rôle |
|---|---|
| `api/_lib/crypto.js` | AES-256-GCM authentifié : `sceller()` / `ouvrir()` ; `chiffrementDispo()`. Sans clé valide → lève (jamais de repli en clair) |
| `api/_lib/cinetpay.js` | `resoudreSiteCinetpay(site)` : résout l'org **et déchiffre** la clé marchand → `cfg` de vérification |
| `api/integrations.js` | GET liste (sans secret) ; POST `register` (chiffre + stocke, **409 si le site est déjà rattaché à une autre org**) ; POST `revoke` |
| `api/banque/notify.js` | Vérifie avec la clé **du marchand** du `cpm_site_id`, attribue à son org (idempotent) ; repli env → holding ; site non vérifiable → ignoré |

Client front : `src/integrations.js` (`listerIntegrations`, `enregistrerIntegration`, `revoquerIntegration`).

## Tests d'acceptation Phase 4
| # | Test | Attendu |
|---|---|---|
| D1 | `sceller`/`ouvrir` round-trip | Objet restitué ; blob altéré → **rejet** (auth GCM) *(vérifié en local)* |
| D2 | POST `register` sans `VIGIE_ENC_KEY` | `501` (aucun stockage en clair) |
| D3 | POST `register` (owner) avec apikey+site | `200`, `credentials_added_at` ; réponse **sans** secret |
| D4 | GET `/api/integrations` | Jamais de `credentials_sealed`/`credentials_enc` |
| D5 | PME B tente `register` d'un site déjà pris par PME A | `409` (anti-détournement) |
| D6 | Webhook, `cpm_site_id` d'un marchand enregistré | Paiement **vérifié avec sa clé** et attribué à son org (idempotent) |
| D7 | Client lit directement la colonne de secret (RLS) | Refusé (privilège colonne révoqué) |

> D1 vérifié en local (`node` + `openssl`). D2–D7 nécessitent un projet Supabase réel : non exécutés ici. Tous les fichiers passent `node --check` et `npm run build`.

## Branchement front (Phase 4)
`App.jsx` est câblé sur `src/integrations.js` — **écran PME « Connecteurs »** (onglet visible seulement en compte réel avec une org PME, à côté de « Partages ») :
- Formulaire de connexion d'un compte marchand CinetPay : `site_id` + **clé API en champ masqué**. La clé est envoyée une seule fois, chiffrée au repos côté serveur, puis **jamais réaffichée** (l'API ne la renvoie pas).
- Liste des comptes connectés (site, statut, date d'enregistrement de la clé) avec révocation.
- Formulaire réservé aux rôles `owner`/`finance_manager` (contrôlé aussi côté serveur) ; messages dédiés pour 409 (site déjà pris) et 501 (`VIGIE_ENC_KEY` absente).

En mode démo (sans Supabase), l'onglet n'apparaît pas et l'application reste **inchangée**.

## Alertes précoces (Phase 4)
À chaque évaluation historisée, le serveur compare au diagnostic précédent et crée une **alerte** en cas de dégradation (état qui empire, ou score qui chute d'au moins 10 points). L'alerte est visible par la PME **et** par une institution ayant un consentement actif — c'est l'alerte précoce du prêteur.

| Fichier | Rôle |
|---|---|
| `migrations/0008_alerts.sql` | `credit_alerts` (kind, severity, from/to état+score, status) + RLS **membre OU `has_grant('assessments')`** |
| `api/_lib/finance.js` | `construireAlerte(préc, courant)` + génération dans `evaluerEtHistoriser` (point de choke unique : import **et** recalcul) |
| `api/alerts.js` | GET `?orgId=[&ouvertes=1]` (membre ou consentement) ; POST `{action:'ack'}` (membre PME) |
| `api/institution/portfolio.js` | expose l'alerte ouverte la plus récente par PME |

Client front : `src/alerts.js` (`listerAlertes`, `acquitterAlerte`). Surfaçage :
- **Espace institution réel** — pastille + message d'alerte sur chaque carte du portefeuille, et liste des alertes ouvertes dans la fiche PME.
- **Espace PME** — bandeau `BandeauAlertesPME` en tête de tous les écrans (compte réel), listant les alertes ouvertes de la PME avec bouton **« J'ai pris connaissance »** (acquittement). Le bandeau rappelle que l'alerte est visible par les institutions autorisées. En mode démo il n'apparaît pas.

Appliquer la migration après `0007` : `0008`.

| # | Test (Phase 4 — alertes) | Attendu |
|---|---|---|
| E1 | `construireAlerte(null, …)` | `null` (première évaluation) *(vérifié en local)* |
| E2 | État « Vigilance » → « Alerte précoce » | Alerte `severity:'haute'`, `kind:'etat'` *(vérifié en local)* |
| E3 | Score −14, même état | Alerte `kind:'score'` *(vérifié en local)* |
| E4 | Amélioration / variation < 10 pts | Aucune alerte *(vérifié en local)* |
| E5 | GET `/api/alerts` par l'institution consentie | Voit les alertes de la PME (RLS `has_grant`) |
| E6 | PME clique « J'ai pris connaissance » (POST `ack`) | Alerte `status:'ack'`, retirée du bandeau |

> E1–E4 vérifiés en local (`node`). E5–E6 nécessitent un projet Supabase réel : non exécutés ici.

## Rapprochement des versements (Phase 4)
Confronte, par mois, les **encaissements** CinetPay (`transactions` source='cinetpay') au **net réellement reversé** sur le compte de la PME (`settlements`), en faisant apparaître les **frais** de l'agrégateur et l'**écart** (encaissé non encore reversé, indicatif — les versements retardent les encaissements). La table `settlements` et sa RLS PME existent déjà (migration 0004) : **aucune nouvelle migration**.

| Fichier | Rôle |
|---|---|
| `api/_lib/settlements.js` | `persistSettlement` (idempotent `UNIQUE(org_id, provider_ref)`) + `rapprocher(cli, orgId, mois)` (brut / net / frais / écart) |
| `api/settlements.js` | GET `?orgId=[&mois=]` (rapprochement, RLS PME) ; POST `{action:'record'}` (owner/finance_manager) |

Client front : `src/settlements.js` (`lireRapprochement`, `enregistrerVersement`). Surfaçage : section **« Rapprochement des versements »** dans l'écran PME **Connecteurs** — sélecteur de mois, tuiles brut/net/frais/écart, liste des versements, et formulaire d'enregistrement d'un versement reçu (rôles habilités).

| # | Test (Phase 4 — versements) | Attendu |
|---|---|---|
| F1 | `rapprocher` : brut 1 250 000, versement net 1 237 500 + frais 12 500 | `ecart = 0` *(vérifié en local)* |
| F2 | POST `record` (owner) | Versement enregistré (idempotent sur `provider_ref`) |
| F3 | POST `record` par un rôle non habilité | `403` |
| F4 | GET `?mois=` | Rapprochement borné au mois, RLS PME |

> F1 vérifié en local (`node`). F2–F4 nécessitent un projet Supabase réel : non exécutés ici.

## Rotation de la clé de chiffrement (Phase 4)
Chaque secret scellé porte en 1er octet la **version** de la clé qui l'a produit. `api/_lib/crypto.js` gère un **trousseau** : la clé active scelle, les anciennes clés restent disponibles pour déchiffrer le temps du re-scellement.

Variables serveur : `VIGIE_ENC_KEY` (clé active), `VIGIE_ENC_KEY_VERSION` (1..255), `VIGIE_ENC_KEYS` (anciennes clés `"1:base64,…"`), `VIGIE_ROTATE_TOKEN` (jeton d'exploitation).

**Procédure** :
1. Placer l'ancienne clé dans `VIGIE_ENC_KEYS` (ex. `1:<ancienne>`).
2. Mettre la nouvelle clé dans `VIGIE_ENC_KEY` et `VIGIE_ENC_KEY_VERSION=2`.
3. Lancer le re-scellement : `POST /api/admin/rotate-keys` avec l'en-tête `x-rotate-token: <VIGIE_ROTATE_TOKEN>` → `{ versionActive, total, rescelles, echecs, dejaAJour }`.
4. Une fois `rescelles` traité (plus de secret en ancienne version), retirer l'ancienne clé de `VIGIE_ENC_KEYS`.

L'endpoint `api/admin/rotate-keys.js` est **désactivé (404)** tant que `VIGIE_ROTATE_TOKEN` est vide ; il ne renvoie **aucun secret**. Seule la clé `service_role` lit la colonne scellée (privilège révoqué pour les autres rôles, migration 0007).

| # | Test (Phase 4 — rotation) | Attendu |
|---|---|---|
| G1 | Sceller en v1, passer la clé active en v2 avec v1 au trousseau | L'ancien blob se déchiffre ; re-scellé en v2 *(vérifié en local)* |
| G2 | Ouvrir un blob v1 sans v1 au trousseau | Rejet explicite *(vérifié en local)* |
| G3 | `POST /api/admin/rotate-keys` sans `VIGIE_ROTATE_TOKEN` | `404` (désactivé) |
| G4 | `POST` avec jeton valide après rotation | Secrets re-scellés en version active ; réponse sans secret |

> G1–G2 vérifiés en local (`node`). G3–G4 nécessitent un projet Supabase réel : non exécutés ici.

## Ingestion automatique des versements (Phase 4)
Deux voies automatiques alimentent `settlements`, en plus de la saisie manuelle :

| Voie | Endpoint | Auth | Comportement |
|---|---|---|---|
| **Webhook** | `POST /api/banque/settlement-notify` | jeton partagé `SETTLEMENT_WEBHOOK_TOKEN` (en-tête `x-settlement-token`) ; **404 si non configuré** | Résout `cpm_site_id → org` (app.integrations), persiste (idempotent). Site non rattaché → ignoré, **jamais d'attribution arbitraire**. Mapping de champs générique (à adapter au payload réel). |
| **Lot** | `POST /api/settlements {action:'import', orgId, lignes:[…]}` | JWT, rôles owner/finance_manager | Ingestion d'un relevé exporté poussé par un script/cron (≤ 2000 lignes), idempotent ; renvoie `{importes, rejets, total}`. |

Pas d'API publique de settlements CinetPay documentée dans le dépôt : l'automatisation repose donc sur le webhook (si l'agrégateur/la banque peut notifier) ou sur l'import de relevé. Aucune API de settlements n'est inventée.

| # | Test (Phase 4 — ingestion) | Attendu |
|---|---|---|
| H1 | `POST /settlement-notify` sans `SETTLEMENT_WEBHOOK_TOKEN` | `404` (désactivé) *(vérifié en local)* |
| H2 | Webhook, jeton OK, `cpm_site_id` rattaché | Versement persisté (idempotent) dans l'org propriétaire |
| H3 | Webhook, site non rattaché | Ignoré (`ignore:'site_non_rattache'`), aucune écriture |
| H4 | `POST {action:'import'}` (owner), lignes valides + une invalide | `{importes:n, rejets:1}` ; ré-import → 0 doublon |

> H1 vérifié en local (`node`). H2–H4 nécessitent un projet Supabase réel : non exécutés ici.

## Frontière de la Phase 4
Phase 4 **complète** côté code : chiffrement au repos + vérification CinetPay par marchand, écran PME connecteurs, alertes précoces (institution + PME/acquittement), rapprochement des versements, rotation de clé, **ingestion automatique des versements**. Il ne reste que l'**exécution des tests A→H** sur un projet Supabase réel (+ clés CinetPay) et le durcissement d'exploitation (sauvegardes, supervision).
