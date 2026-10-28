# HOPE International Project

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

Double authentification : une vérification par code à usage unique envoyé par email ou SMS est prévue (la connexion se fait aujourd'hui par email et mot de passe uniquement).

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

## Outillage

### Tests

| Commande | Rôle |
|---|---|
| `npm test` | Tous les tests unitaires : `@hope/shared`, API (MySQL `hope_test`), site (Vitest) |
| `npm test -w @hope/web` | Tests du site (`apps/web/test/`) : fonctions pures, composants, en-têtes de sécurité |
| `npm run test:coverage` | Tests de l'API avec couverture (`--experimental-test-coverage`, échec sous 85 % des lignes) |
| `npm run test:e2e` | Scénarios Playwright (`apps/web/e2e/`) |
| `npm run check` | Dictionnaires i18n cohérents et contrastes WCAG des tokens |

Tests du site : Vitest + Testing Library. `test/intl.jsx` fournit `renderWithIntl` (NextIntlClientProvider + messages français), `translator(namespace)` et `message("a.b.c")` pour comparer aux dictionnaires sans recopier les textes. L'alias `@/` est celui de `jsconfig.json`. Le DOM jsdom est posé par `test/setup-dom.js` dans un environnement Vitest `node` : l'environnement `jsdom` de Vite 8 échoue à résoudre les paquets quand le chemin du dépôt contient un espace (« HOPE Int »).

Scénarios e2e : connexion d'un membre de démo, refus du back-office à un membre, bascule fr → en sur `/projets`, en-têtes CSP sans violation, don Mobile Money jusqu'à la redirection vers le prestataire (API de paiement simulée par `page.route`, aucun paiement réel). En CI, Playwright démarre lui-même l'API et le site (`webServer`, base `hope_e2e` migrée et seedée). En local, rien n'est démarré : lancer l'API et le site (`npm run dev`, base seedée), puis `npx playwright install chromium` (une fois) et `E2E_BASE_URL=http://localhost:3001 npm run test:e2e`.

### CI/CD

- [ci.yml](.github/workflows/ci.yml) : lint, `check:i18n`, `check:contrast`, tests (shared, site, API avec seuil de couverture), `npm audit --omit=dev --audit-level=high`, build du site, e2e Playwright (rapport en artefact) et build des images (Buildx, cache GitHub Actions).
- [release.yml](.github/workflows/release.yml) : sur `master` et sur les tags `v*`, publie `ghcr.io/<propriétaire>/hope-api` et `hope-web` (tags `sha-<commit>`, `edge`, `X.Y.Z`, `latest`). Variables de dépôt : `PUBLIC_API_BASE_URL`, `STRIPE_PUBLISHABLE_KEY` (inlinées dans l'image du site). Le déploiement (hébergeur non choisi) est un job commenté : tirer les images, **migrer** (`docker compose run --rm backend npm run migrate`), puis `up -d --wait`.
- [dependabot.yml](.github/dependabot.yml) : npm (hebdomadaire, mineures groupées, majeures par famille), GitHub Actions, images Docker.

### En-têtes de sécurité du site (CSP)

`apps/web/proxy.js` génère un nonce par requête et pose, sur le site public comme sur `/admin` : `Content-Security-Policy` (`script-src 'self' 'nonce-…' 'strict-dynamic'` + Stripe, `connect-src` et `img-src` limités au site, à l'API et à Stripe, `frame-ancestors 'none'`…), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` et, en production, HSTS. La politique est construite par le module pur `apps/web/security/headers.js` (testé). Next applique le nonce à ses propres scripts ; le script anti-flash du thème le lit via `headers()` (`app/_lib/document.jsx`), ce qui rend les pages dynamiques (indispensable : une page statique n'aurait pas de nonce). `style-src` garde `'unsafe-inline'` (attributs `style` de React, sweetalert2, Chart.js) ; `'unsafe-eval'` et les websockets ne sont autorisés qu'en développement. Ajouter un service tiers (analytics, cartes, vidéos) impose de compléter `security/headers.js`.

### Docker

Les deux images tournent sous l'utilisateur `node` et déclarent un `HEALTHCHECK` (Node `fetch`, pas de curl) : `/api/health` pour l'API, `/` pour le site ; docker compose attend `service_healthy` (MySQL → API → site). Un volume `backend_uploads` créé avant ce changement appartient à root : `docker compose run --rm -u root backend chown -R node:node uploads`. Si le dépôt est dans OneDrive, des fichiers « à la demande » peuvent faire échouer `docker compose build` (`invalid file request`) : les rendre disponibles hors connexion ou construire depuis une copie hors OneDrive.

### Préproduction

[docker-compose.staging.yml](docker-compose.staging.yml) surcharge la configuration : images GHCR (`IMAGE_TAG`), `NODE_ENV=production`, migrations explicites (`MIGRATE_ON_START=false`), cookies `Secure`, Stripe et Notch Pay **en mode test uniquement** (une clé live bloque le démarrage), SMTP de test. Variables dans `.env.staging` (non versionné) :

```bash
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.staging.yml --env-file .env.staging"
$COMPOSE pull
$COMPOSE run --rm backend npm run migrate
$COMPOSE up -d --wait
```

### Sauvegardes

`infra/backup/backup.sh` : `mysqldump --single-transaction` compressé + archive du volume des images, empreintes SHA-256, rotation 7 quotidiennes / 4 hebdomadaires (dimanche), chiffrement si `BACKUP_PASSPHRASE` (gpg, sinon openssl AES-256), envoi S3-compatible si `S3_BUCKET` (+ `S3_ENDPOINT`, `AWS_*`). Service planifié : copier `infra/backup/backup.env.example` en `backup.env`, puis `docker compose --profile backup up -d backup` (cron `BACKUP_CRON`, 02:30 UTC par défaut ; fichiers dans le volume `backups`). La rétention distante se règle par une règle de cycle de vie du bucket. Conserver la phrase de passe hors du serveur.

**Tester la restauration (au moins une fois par trimestre)**, dans une base jetable, jamais sur la base de travail :

1. Produire une sauvegarde : `docker compose --profile backup run --rm -e BACKUP_RUN_NOW=true backup` (ou attendre la nuit).
2. Restaurer dans `hope_restore_test` avec le compte root (droit `CREATE`) :

```bash
docker compose --profile backup run --rm -e MYSQL_ROOT_PASSWORD --entrypoint sh backup -c '
  apk add --no-cache mariadb-client mariadb-connector-c gnupg coreutils >/dev/null && ls /backups/daily &&
  DB_USER=root DB_PASSWORD="$MYSQL_ROOT_PASSWORD" sh /opt/backup/restore.sh \
    --db /backups/daily/db-HORODATAGE.sql.gz --target-db hope_restore_test \
    --uploads /backups/daily/uploads-HORODATAGE.tar.gz --uploads-dir /tmp/uploads-test'
```

3. Vérifier les compteurs affichés (membres, dons, dernière migration) et le nombre d'images, puis `DROP DATABASE hope_restore_test`. `restore.sh` refuse d'écraser la base courante sans `--yes` et vérifie les empreintes.

### Supervision

- Journaux : `apps/api/config/logger.js` (pino + pino-http) — JSON en production, lisibles en développement (pino-pretty), muets en test, identifiant de requête (`X-Request-Id`), cookies, `Authorization`, mots de passe, jetons, emails et téléphones masqués, query string retirée des URL. Variables : `LOG_LEVEL`, `LOG_PRETTY=false`.
- Erreurs : `apps/api/config/sentry.js`, actif seulement si `SENTRY_DSN` est défini (`SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_RELEASE` = SHA du commit dans l'image). Aucune donnée personnelle envoyée.
- Sonde : `GET /api/health` (vérifie MySQL), utilisée par les healthchecks Docker.

### Documentation de l'API

`apps/api/openapi.yaml` (OpenAPI 3.1, écrit à la main depuis `apps/api/routes/`) : routes, paramètres, corps, codes de réponse, authentification par cookie `hope_session` et en-tête CSRF `X-Requested-With`. `npm run docs:api` le valide (`@redocly/cli lint`, règles dans `apps/api/redocly.yaml`) et génère `apps/api/docs/index.html` (page statique, non versionnée). À mettre à jour avec chaque nouvelle route.

### Données de démonstration volumineuses

`npm run seed:demo` (après `npm run seed`) : ~200 membres répartis sur les 10 régions (`@demo.hope.test`, mot de passe `Member@123`), ~2 000 dons sur 3 ans (carte et Mobile Money, mensuels, remboursés totalement ou partiellement, en vérification, en attente, échoués, contestés ; reçus numérotés à la suite de `receipt_sequences`), 30 événements avec inscriptions, 60 candidatures. Options : `-- --scale=5` (volume ×5), `--seed=42` (générateur déterministe). Comme `npm run seed`, refusé si `NODE_ENV=production` (sauf `--force`) ; `npm run seed -- --reset` liste les tables qui vont être vidées et laisse 5 s pour annuler (`--yes` pour ne pas attendre).
