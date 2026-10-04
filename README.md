# HOPE International

Plateforme de l'association : site public (projets, campagnes de dons, actualités, agenda, candidatures), dons par carte (Stripe, EUR) et Mobile Money Orange / MTN (Notch Pay ou Flutterwave, XAF) avec reçus PDF, espace membre, et administration par rôles.

Monorepo npm workspaces :

```
apps/
  api/      @hope/api     Express 5 + MySQL 8
  web/      @hope/web     Next.js 16 (App Router), CSS maison (src/styles)
packages/
  shared/   @hope/shared  Référentiels métier et RBAC communs à l'API et au site
infra/
  mysql/init/             Scripts exécutés à la création du volume MySQL
```

Les rôles, permissions, statuts, régions et limites de don sont définis **une seule fois** dans `packages/shared` : l'API les importe (`require("@hope/shared/rbac")`) et le site aussi (`import { PERMISSIONS } from "@hope/shared/rbac"`).

Prérequis : Node.js 24 (voir `.nvmrc`) et Docker. Une seule installation à la racine : `npm install`.

## Démarrage

1. Copier `.env.example` en `.env` à la racine et choisir les mots de passe MySQL (utilisés par docker compose).
2. Copier `apps/api/.env.example` en `apps/api/.env` ; `DB_USER` / `DB_PASSWORD` doivent correspondre à `MYSQL_USER` / `MYSQL_PASSWORD`.
3. Lancer :

```bash
npm install
npm run db        # MySQL + phpMyAdmin dans Docker
npm run dev       # API (5000) et site (3001) ensemble
```

Ou tout dans Docker : `docker compose up --build` (ajouter `--profile dev` pour phpMyAdmin).

- Site : http://localhost:3001
- API : http://localhost:5000/api (santé : `/api/health`)
- phpMyAdmin (profil `dev`) : http://localhost:8080
- MySQL : 127.0.0.1:3306 (volume persistant `mysql_data`)

MySQL et phpMyAdmin ne sont exposés que sur la machine hôte (`127.0.0.1`). Les mots de passe du `.env` racine ne s'appliquent qu'à la **création** du volume : pour les changer ensuite, utiliser `ALTER USER` dans MySQL.

Données de démonstration : `npm run seed` (complète une base vide) ou `npm run seed -- --reset` (réinitialise les contenus, dons, événements, candidatures et messages de démo ; les comptes sont conservés).

Comptes de démo : `admin@hope.org` / `Admin@123456` · équipe (`directrice@`, `rh@`, `finance@`, `orga@`, `it@`, `region@`, `secretaire@hope.org`) / `Hope@123456` · membres (`alice@`, `brice@`, `kevin@`, `sandrine@hope.org`) / `Member@123`.

## Scripts (racine)

| Script | Rôle |
|---|---|
| `dev`, `dev:api`, `dev:web` | Serveurs de développement (ports libres choisis automatiquement, voir ci-dessous) |
| `build`, `start:api`, `start:web` | Build et lancement en production |
| `lint` | ESLint sur tous les workspaces |
| `test` | Tests de `@hope/shared` et de l'API |
| `migrate` | Applique les migrations (`npm run migrate -- --status` pour l'état) |
| `seed` | Données de démonstration |
| `db` | MySQL + phpMyAdmin dans Docker |

**Ports en développement** : `npm run dev` vise 5000 pour l'API et 3001 pour le site ; si un port est occupé, le suivant libre est pris et les deux applications reçoivent les bonnes adresses (URL de l'API pour le site, origine CORS et liens de retour pour l'API). Les URL réellement utilisées s'affichent au démarrage. Ports souhaités modifiables avec `API_PORT` et `WEB_PORT`. Si le site HOPE tourne déjà, le lanceur l'indique au lieu d'en démarrer un second (Next n'en accepte qu'un par dossier). Lancée seule (`npm run dev:api`), l'API bascule aussi sur le port suivant ; `npm run dev:web` vise alors l'API sur `API_PORT`. En production, le port reste imposé : un conflit est une erreur.

Pour un script d'une seule appli : `npm run <script> -w @hope/api` (ou `@hope/web`, `@hope/shared`). Une dépendance s'ajoute dans son workspace : `npm install <paquet> -w @hope/web`.

## Configuration

`.env` à la racine (modèle : `.env.example`), lu par docker compose :

| Variable | Rôle |
|---|---|
| `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD` | Comptes MySQL créés avec le volume ; l'API utilise l'utilisateur applicatif, jamais root |
| `STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe inlinée dans le build Docker du site |

`apps/api/.env` (modèle commenté : `apps/api/.env.example`) :

| Variable | Rôle |
|---|---|
| `JWT_SECRET` | ≥ 32 caractères aléatoires (obligatoire en production) |
| `DB_*` | Connexion MySQL (utilisateur applicatif) |
| `MIGRATE_ON_START` | `false` pour ne pas migrer au démarrage (migrations lancées à part au déploiement) |
| `COOKIE_SAMESITE`, `COOKIE_SECURE`, `COOKIE_DOMAIN` | Cookie de session ; `COOKIE_SAMESITE=none` si le site et l'API sont sur des domaines différents |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Dons par carte ; le webhook signé est obligatoire en production |
| `NOTCHPAY_PUBLIC_KEY`, `NOTCHPAY_WEBHOOK_HASH` | Dons Mobile Money via Notch Pay (prioritaire) |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` | Dons Mobile Money via Flutterwave |
| `MOBILE_MONEY_PROVIDER` | Force le prestataire Mobile Money (`notchpay` ou `flutterwave`) |
| `SMTP_*` | Emails (identifiants, reçus, réinitialisation). Sans SMTP, ils s'affichent dans la console en développement |
| `FRONTEND_URL`, `API_PUBLIC_URL`, `CORS_ORIGIN` | Liens dans les emails, retour de paiement, origines autorisées |
| `ORG_*`, `RECEIPT_FISCAL_MENTION` | Informations imprimées sur les reçus de don (la mention fiscale est un texte libre à faire valider : aucun texte juridique n'est fourni par défaut) |
| `RECEIPT_TIMEZONE` | Fuseau de l'année et des dates des reçus (défaut `Africa/Douala`) |
| `SMTP_TIMEOUT_MS`, `EMAIL_OUTBOX_INTERVAL_MS`, `EMAIL_OUTBOX_WORKER` | File d'envoi des emails (délai SMTP, fréquence du worker, `false` pour ne pas lancer le worker dans une instance) |

`apps/web/.env.local` (modèle : `apps/web/.env.example`) : `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (URL publique : canoniques, hreflang, Open Graph, sitemap) et `API_INTERNAL_URL` (URL de l'API pour le rendu serveur ; en Docker `http://backend:5000/api`).

Un moyen de paiement non configuré est simplement affiché comme indisponible sur le site. La page **Administration → État du système** (rôle IT) liste ce qui reste à configurer.

Webhooks à déclarer chez les prestataires :
- Stripe : `POST {API}/payment/webhook` (événements `payment_intent.*`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`)
- Notch Pay : `POST {API}/payment/notchpay/webhook`
- Flutterwave : `POST {API}/payment/flutterwave/webhook`

Les variables `NEXT_PUBLIC_*` du site sont inlinées au build Next.js : en Docker, elles sont passées en build-args dans [docker-compose.yml](docker-compose.yml).

## Dons et reçus

- **Statuts** : `pending`, `succeeded`, `failed`, `canceled`, `refunded`, `disputed` (litige bancaire) et `review` (montant ou devise confirmés par le prestataire différents du don : à valider ou rejeter dans **Administration → Dons**, rôle finance). Les transitions sont appliquées atomiquement : un don réussi ne peut plus redevenir échoué ; il ne peut devenir que remboursé ou contesté.
- **Paiements tardifs** : les webhooks et le rapprochement (**Finance → Rapprocher**) relisent aussi les dons échoués ou annulés récents, pour rattraper un paiement Mobile Money validé après coup.
- **Remboursements** : total → `refunded` (reçu annulé) ; partiel → le don reste réussi, `refunded_amount` est déduit de toutes les statistiques et indiqué sur le reçu.
- **Reçus** : numérotés par année (`HOPE-2026-000042`, compteur atomique), figés à l'émission (nom, affectation, montant), récapitulatif annuel téléchargeable dans l'espace membre. Un donateur mensuel sans compte peut arrêter son don depuis la page de son reçu.
- **Emails** : envoyés par une file persistante (`email_outbox`) avec nouvelles tentatives ; sans SMTP configuré, ils s'affichent dans la console en développement.

## Langues

Le site (public, espace membre et administration) est traduit en français, anglais et espagnol : URL sans préfixe en français, `/en/...` et `/es/...` sinon (voir [apps/web/README.md](apps/web/README.md)). L'API traduit ses messages d'erreur selon `Accept-Language` (`apps/api/i18n/messages.js`, un test vérifie que le catalogue reste aligné sur le code). Les emails et les reçus PDF restent en français.

## Rôles et sécurité

Les droits sont définis dans `packages/shared/src/rbac.js` et relus en base à chaque requête (un retrait de droits s'applique immédiatement). Règles : on ne peut attribuer que des rôles dont on possède tous les droits, seul un admin crée un admin, personne ne modifie ses propres rôles, le dernier administrateur actif est protégé, et un compte créé par l'administration doit changer son mot de passe provisoire à la première connexion.

Portée régionale : une directrice régionale (permission régionale sans portée globale) ne gère que les projets de sa région, ne publie actualités et témoignages que rattachés à un projet de sa région, et ne voit que les statistiques, dons et rapports de sa région. Les candidats indiquent des pôles d'intérêt indicatifs : la personne qui accepte une candidature choisit explicitement les rôles, parmi ceux qu'elle peut attribuer.

Session : l'API pose le JWT dans un cookie `httpOnly` (`SameSite=Lax`, `Secure` en production), inaccessible au JavaScript du site. Toute requête d'écriture authentifiée par cookie doit porter l'en-tête `X-Requested-With: XMLHttpRequest` (protection CSRF). Un changement de mot de passe ferme les autres sessions ; `POST /api/auth/logout` efface le cookie. L'en-tête `Authorization: Bearer` reste accepté pour les scripts.

## Base de données et migrations

Le schéma évolue par migrations versionnées dans `apps/api/migrations/` (`NNN_description.js`, exportant `up()`), appliquées dans l'ordre et une seule fois (suivi dans la table `schema_migrations`, verrou MySQL contre les exécutions concurrentes). Elles s'exécutent au démarrage de l'API, ou via `npm run migrate`.

Pour faire évoluer le schéma : créer `002_….js` avec les helpers de `config/schema.js` (`addColumn`, `addIndex`…). MySQL valide implicitement les DDL : une migration doit rester rejouable si elle échoue en cours de route. Ne jamais modifier une migration déjà appliquée en production.

## Tests et CI

```bash
npm test
```

- `@hope/shared` : tests unitaires du RBAC et des référentiels.
- `@hope/api` : tests d'intégration (`node:test` + `supertest`) sur une vraie base MySQL **`hope_test`**, vidée à chaque fichier de test (garde-fou : le nom doit finir par `_test`). Elle est créée automatiquement avec le volume Docker (`infra/mysql/init`). Les prestataires de paiement et le SMTP sont désactivés pendant les tests.

GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)) lance à chaque push sur `master` et sur chaque pull request : lint, tests (avec un service MySQL 8), build du site et build des deux images Docker.
