# HOPE International

Plateforme de l'association : site public (projets, campagnes de dons, actualités, agenda, candidatures), dons par carte (Stripe, EUR) et Mobile Money Orange / MTN (Notch Pay ou Flutterwave, XAF) avec reçus PDF, espace membre, et administration par rôles.

Monorepo npm workspaces :

```
apps/
  api/      @hope/api     Express 5 + MySQL 8
  web/      @hope/web     Next.js 16 (App Router), CSS maison (src/styles)
packages/
  shared/   @hope/shared  Référentiels métier et RBAC communs à l'API et au site
```

Les rôles, permissions, statuts, régions et limites de don sont définis **une seule fois** dans `packages/shared` : l'API les importe (`require("@hope/shared/rbac")`) et le site aussi (`import { PERMISSIONS } from "@hope/shared/rbac"`).

Une seule installation à la racine : `npm install`.

## Lancer le projet avec Docker

```bash
docker compose up --build
```

- Site : http://localhost:3001
- API : http://localhost:5000/api (santé : `/api/health`)
- phpMyAdmin : http://localhost:8080
- MySQL : localhost:3306 (volume persistant `mysql_data`)

Données de démonstration : `npm run seed` (complète une base vide) ou `npm run seed -- --reset` (réinitialise les contenus, dons, événements, candidatures et messages de démo ; les comptes sont conservés).

Comptes de démo : `admin@hope.org` / `Admin@123456` · équipe (`directrice@`, `rh@`, `finance@`, `orga@`, `it@`, `region@`, `secretaire@hope.org`) / `Hope@123456` · membres (`alice@`, `brice@`, `kevin@`, `sandrine@hope.org`) / `Member@123`.

## Configuration

Les secrets backend viennent de `apps/api/.env` (modèle commenté : `apps/api/.env.example`) :

| Variable | Rôle |
|---|---|
| `JWT_SECRET` | ≥ 32 caractères aléatoires (obligatoire en production) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Dons par carte ; le webhook signé est obligatoire en production |
| `NOTCHPAY_PUBLIC_KEY`, `NOTCHPAY_WEBHOOK_HASH` | Dons Mobile Money via Notch Pay (prioritaire) |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH` | Dons Mobile Money via Flutterwave |
| `MOBILE_MONEY_PROVIDER` | Force le prestataire Mobile Money (`notchpay` ou `flutterwave`) |
| `SMTP_*` | Emails (identifiants, reçus, réinitialisation). Sans SMTP, ils s'affichent dans la console en développement |
| `FRONTEND_URL`, `API_PUBLIC_URL` | Liens dans les emails et retour de paiement |
| `ORG_*`, `RECEIPT_FISCAL_MENTION` | Informations imprimées sur les reçus de don |

Un moyen de paiement non configuré est simplement affiché comme indisponible sur le site. La page **Administration → État du système** (rôle IT) liste ce qui reste à configurer.

Webhooks à déclarer chez les prestataires :
- Stripe : `POST {API}/payment/webhook` (événements `payment_intent.*`, `invoice.paid`, `customer.subscription.deleted`)
- Notch Pay : `POST {API}/payment/notchpay/webhook`
- Flutterwave : `POST {API}/payment/flutterwave/webhook`

Les variables `NEXT_PUBLIC_*` du frontend sont fixées comme build-args dans [docker-compose.yml](docker-compose.yml) (inlinées au build Next.js).

## Rôles et sécurité

Les droits sont définis dans `packages/shared/src/rbac.js` et relus en base à chaque requête (un retrait de droits s'applique immédiatement). Règles : on ne peut attribuer que des rôles dont on possède tous les droits, seul un admin crée un admin, personne ne modifie ses propres rôles, le dernier administrateur actif est protégé, et un compte créé par l'administration doit changer son mot de passe provisoire à la première connexion.

## Lancer en local sans Docker

Depuis la racine :

```bash
npm install
npm run db        # MySQL + phpMyAdmin dans Docker
npm run dev       # API (5000) et site (3001) ensemble
```

Autres scripts racine : `dev:api`, `dev:web`, `build`, `start:api`, `start:web`, `lint`, `seed`. Pour lancer un script d'une seule appli : `npm run <script> -w @hope/api` (ou `@hope/web`). Une dépendance s'ajoute dans son workspace : `npm install <paquet> -w @hope/web`.

Les images Docker se construisent depuis la racine (contexte `.`), car elles ont besoin du lockfile unique et de `packages/shared`.
