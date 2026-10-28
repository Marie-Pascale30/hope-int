# Mise en production

Ce guide liste, dans l'ordre, ce qu'il faut faire pour mettre HOPE International Project en ligne sur **https://hopeintapp.com**. Les détails techniques (Docker, préproduction, sauvegardes, supervision) sont dans le [README](../README.md).

Les cases à cocher marquées **(association)** demandent une décision ou une information de l'association ; les autres sont techniques.

## 1. Avant le premier déploiement

- [ ] **(association)** Choisir l'hébergeur (serveur avec Docker) et le noter dans `LEGAL_HOST_*` (voir § 3).
- [ ] **(association)** Fournir le numéro de déclaration de l'association pour les mentions légales.
- [ ] Faire pointer le DNS de `hopeintapp.com` (et `www`) vers le serveur, et prévoir l'adresse de l'API : soit un sous-domaine (`https://api.hopeintapp.com/api`), soit un proxy qui sert `/api` sur le même domaine.
- [ ] Certificat HTTPS (Let's Encrypt via le proxy : Caddy, Traefik ou Nginx).
- [ ] **(association)** Ouvrir un compte SMTP transactionnel (Brevo, Mailjet, Postmark…) avec une adresse d'expédition sur le domaine, et configurer SPF/DKIM. **Sans SMTP, l'API refuse de démarrer** : reçus, mots de passe oubliés et codes de connexion de l'équipe passent par email.
- [ ] **(association)** Activer les comptes **live** Stripe (EUR) et Notch Pay ou Flutterwave (XAF).
- [ ] **(association)** Faire valider les mentions imprimées sur les reçus : `ORG_*` et `RECEIPT_FISCAL_MENTION`.
- [ ] Créer un projet Sentry (facultatif mais recommandé) pour `SENTRY_DSN`.

## 2. Variables du dépôt GitHub (build du site)

Les variables `NEXT_PUBLIC_*` sont inscrites dans l'image du site au moment du build. Les définir dans *Settings → Secrets and variables → Actions → Variables* :

| Variable | Valeur de production |
| --- | --- |
| `PUBLIC_SITE_URL` | `https://hopeintapp.com` |
| `PUBLIC_API_BASE_URL` | `https://api.hopeintapp.com/api` (ou `https://hopeintapp.com/api`) |
| `STRIPE_PUBLISHABLE_KEY` | clé publique Stripe **live** (`pk_live_…`) |

## 3. Variables du serveur

### API (`apps/api/.env`)

Au démarrage en production, l'API vérifie sa configuration : elle **refuse de démarrer** si un point bloquant manque et affiche des avertissements pour le reste (`config/productionCheck.js`).

| Variable | Valeur | Bloquant |
| --- | --- | --- |
| `NODE_ENV` | `production` | |
| `JWT_SECRET` | 64 caractères aléatoires (`openssl rand -hex 32`) | oui |
| `FRONTEND_URL` | `https://hopeintapp.com` | oui |
| `API_PUBLIC_URL` | URL publique de l'API, en https | oui |
| `CORS_ORIGIN` | `https://hopeintapp.com,https://www.hopeintapp.com` | oui |
| `COOKIE_SECURE` | `true` (ou laisser vide) | oui si `false` |
| `DB_PASSWORD` | mot de passe MySQL | oui |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | compte SMTP | oui |
| `ENGAGEMENT_TOKEN_SECRET` | 64 caractères aléatoires | avertissement |
| `TRUST_PROXY` | `1` derrière un proxy | avertissement |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | clés **live** | avertissement |
| `MOBILE_MONEY_PROVIDER`, `NOTCHPAY_*` ou `FLUTTERWAVE_*` | clés **live** | avertissement |
| `SENTRY_DSN` | DSN du projet Sentry | avertissement |
| `ORG_*`, `RECEIPT_FISCAL_MENTION` | identité imprimée sur les reçus | |
| `MIGRATE_ON_START` | `false` (migrations lancées explicitement, § 4) | |

La liste complète et commentée est dans `apps/api/.env.example`.

### Site

`NODE_ENV=production`, `API_INTERNAL_URL` (adresse de l'API vue depuis le conteneur du site, ex. `http://backend:5000/api`) et les variables des mentions légales documentées dans `apps/web/.env.example` (`LEGAL_*`). Les lignes non renseignées sont masquées sur la page.

### Webhooks à déclarer chez les prestataires

| Prestataire | URL |
| --- | --- |
| Stripe | `<API_PUBLIC_URL>/payment/webhook` |
| Notch Pay | `<API_PUBLIC_URL>/payment/notchpay/webhook` |
| Flutterwave | `<API_PUBLIC_URL>/payment/flutterwave/webhook` |

## 4. Premier déploiement

Sur le serveur, avec les images publiées par le workflow *Release* (push sur `master` ou tag `vX.Y.Z`) :

```sh
docker compose pull backend frontend
docker compose run --rm backend npm run migrate          # schéma de la base
docker compose run --rm backend npm run content:import   # projets, actualités et témoignages réels
docker compose run --rm backend npm run admin:create -- --email presidente@hopeintapp.com --name "Prénom Nom"
docker compose up -d --wait
docker compose --profile backup up -d backup             # sauvegardes quotidiennes
```

- `content:import` n'ajoute que le contenu réel (aucun compte ni don de démonstration) et peut être relancé sans risque : il ignore ce qui existe déjà. **Ne jamais lancer `npm run seed` en production** (comptes aux mots de passe publics ; le script le refuse).
- `admin:create` affiche un mot de passe provisoire **une seule fois** ; il doit être changé à la première connexion. L'administrateur crée ensuite les comptes de l'équipe depuis le back-office.
- À la première connexion, chaque membre de l'équipe reçoit un code par email (double authentification).

## 5. Vérifications avant l'ouverture

- [ ] `https://hopeintapp.com` s'affiche en HTTPS, le cadenas est valide, `www` redirige.
- [ ] `GET <API_PUBLIC_URL>/health` répond `200`.
- [ ] Les journaux de démarrage de l'API n'affichent aucun avertissement de configuration inattendu.
- [ ] Inscription d'un compte invité : l'email de bienvenue arrive.
- [ ] Connexion d'un compte de l'équipe : le code arrive par email.
- [ ] **Un vrai don de faible montant** par carte puis par Mobile Money : paiement confirmé dans l'administration, reçu PDF reçu par email, mentions du reçu correctes.
- [ ] Pages Mentions légales et Politique de confidentialité complètes.
- [ ] Une **restauration de sauvegarde** testée au moins une fois (procédure dans le README, § Sauvegardes). Copier d'abord `infra/backup/backup.env.example` en `backup.env`.
- [ ] Application mobile : `HOPE_APP_URL` = `https://hopeintapp.com` (valeur par défaut) avant le build Play Store.

## 6. Mises à jour suivantes

```sh
docker compose --profile backup run --rm -e BACKUP_RUN_NOW=true backup   # sauvegarde avant migration
docker compose pull backend frontend
docker compose run --rm backend npm run migrate
docker compose up -d --wait
```
