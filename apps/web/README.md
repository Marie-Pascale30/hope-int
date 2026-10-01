# HOPE International — Frontend

Application Next.js (App Router) consommant l'API backend Express/MySQL (`apps/api`) ; les référentiels et permissions viennent de `@hope/shared` (`packages/shared`). L'authentification reste 100% côté client : token JWT, rôles et permissions stockés dans `localStorage` (voir `src/utils/session.js`).

## Configuration

Copier `.env.example` en `.env.local` et renseigner :

- `NEXT_PUBLIC_API_BASE_URL` — URL de l'API backend (par défaut `http://localhost:5000/api`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — clé publique Stripe pour la page `/donate`

## Scripts

- `npm run dev` — serveur de développement sur [http://localhost:3001](http://localhost:3001)
- `npm run build` — build de production
- `npm run start` — sert le build de production
- `npm run lint` — ESLint (`eslint-config-next`)

## Structure

- `app/` — routage par fichiers (App Router) : un dossier par route, chaque `page.jsx` important sa vue correspondante depuis `src/views/`
- `src/views/` — composants de page (landing, login, register, home, admin, donate, contact)
- `src/components/` — composants partagés, dont `ProtectedRoute`/`AdminRoute` (garde d'accès côté client via `localStorage`)
- `src/services/` — appels API (axios)
- `src/utils/`, `src/i18n/` — session, alertes, permissions, traductions
