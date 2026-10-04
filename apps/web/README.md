# HOPE International — Site (@hope/web)

Application Next.js 16 (App Router) consommant l'API Express/MySQL (`apps/api`). Les référentiels et permissions viennent de `@hope/shared` (`packages/shared`).

## Session

La session est un cookie `httpOnly` posé par l'API à la connexion : le JavaScript du site n'a jamais accès au jeton. Axios envoie ce cookie (`withCredentials`) et l'en-tête `X-Requested-With`, exigé par la protection CSRF de l'API (voir `src/services/api.js`). Le profil (rôles, permissions) est relu via `GET /auth/me` au chargement (`src/context/AuthContext.jsx`). Les permissions ne servent qu'à afficher ou masquer l'interface : l'API reste la seule autorité.

## Configuration

Copier `.env.example` en `.env.local` et renseigner :

- `NEXT_PUBLIC_API_BASE_URL` — URL de l'API (par défaut `http://localhost:5000/api`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — clé publique Stripe pour la page `/don`
- `NEXT_PUBLIC_SITE_URL` — URL publique du site (balises canoniques, hreflang, Open Graph, sitemap ; défaut `http://localhost:3001`, inlinée au build)
- `API_INTERNAL_URL` — (serveur uniquement) URL de l'API pour le rendu serveur des pages publiques ; repli sur `NEXT_PUBLIC_API_BASE_URL`. En Docker : `http://backend:5000/api` (voir `docker-compose.yml`)

## Langues (next-intl)

Le site est traduit en français, anglais et espagnol. Le français garde les URL sans préfixe (`/projets`), l'anglais et l'espagnol sont servis sous `/en/...` et `/es/...` (`src/i18n/routing.js`, `localePrefix: "as-needed"`). Le proxy (`proxy.js`) choisit la langue : préfixe d'URL, puis cookie `NEXT_LOCALE`, puis `Accept-Language`. Le back-office (`/admin`) n'a pas de préfixe : il lit la langue dans le cookie `NEXT_LOCALE` (`src/i18n/request.js`).

- Dictionnaires : `src/i18n/messages/{fr,en,es}/{common,site,account,admin}.json`. `common.json` porte l'habillage partagé (`common`, `nav`, `theme`, `footer`, `language`, `errors`) ; chaque autre fichier a une seule clé racine égale à son nom (`site`, `account`, `admin`). Une clé ne peut appartenir qu'à un fichier (vérifié au chargement) ; une clé absente en anglais ou en espagnol retombe sur le français.
- Composant client ou serveur non async : `const t = useTranslations("site.home")` ; serveur async : `await getTranslations({ locale, namespace })`. Pluriels et variables au format ICU (`{count, plural, one {...} other {...}}`).
- Liens : `Link` de `src/i18n/navigation.js` (préfixe automatique) ; pour une URL texte (`<Button href>`) : `const lp = useLocalePath(); lp("/don")`.
- Formats : `const f = useFormat()` (`src/i18n/format.js`) → `f.date()`, `f.money(12, "eur")`, `f.number()`, `f.time()`… dans la langue courante, fuseau `Africa/Douala` identique serveur / client. Les fonctions historiques de `src/utils/format.js` restent en français.
- Le contenu saisi en base (titres, textes) reste dans sa langue de saisie. Le client axios envoie `Accept-Language` (langue de `<html lang>`).

## Rendu et SEO

Les pages publiques (accueil, projets, actualités, agenda, rejoindre, contact) sont des composants serveur : les données sont lues côté serveur (`src/services/server.js`, cache revalidé toutes les 60 s) et seuls les îlots interactifs (filtres, calendrier, formulaires, inscription à un événement) sont des composants client. Un détail inexistant ou non publié renvoie une vraie 404. Métadonnées par page et par langue (`src/views/site/seo.js`), image Open Graph générée (`app/[locale]/opengraph-image.jsx`), `app/sitemap.js`, `app/robots.js`, JSON-LD (NGO, Event, NewsArticle).

## Scripts

Depuis la racine du monorepo (`npm run dev:web`, `npm run build`, `npm run lint`) ou avec `-w @hope/web` :

- `dev` — serveur de développement sur [http://localhost:3001](http://localhost:3001)
- `build` — build de production (`standalone`, embarque `@hope/shared`)
- `start` — sert le build de production
- `lint` — ESLint (`eslint-config-next`)

## Structure

- `app/` — routage par fichiers : `[locale]/` pour le site public et l'espace membre (un layout racine par langue), `admin/` pour l'administration (layout racine distinct). Chaque `page.jsx` importe sa vue depuis `src/views/`
- `src/views/` — composants de page (`site/`, `account/`, `admin/`)
- `src/components/` — composants partagés (`ui/`, `site/`, `admin/`, garde d'accès `RequireAuth`)
- `src/services/` — client API (axios) et appels par domaine
- `src/context/`, `src/hooks/` — session (`AuthContext`), référentiels (`useMeta`), chargement asynchrone
- `src/utils/` — permissions, libellés, formats, alertes
- `src/i18n/` — configuration next-intl, dictionnaires, navigation et formats localisés
- `src/styles/` — CSS maison (polices chargées par `next/font` dans `app/_lib/fonts.js`)
