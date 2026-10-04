import { useLocale } from "next-intl";
import { getFormatters } from "../utils/format";

// Un jeu de formatteurs par langue (objet stable, utilisable dans les dependances de useMemo).
const cache = new Map();

export function formattersFor(locale) {
  if (!cache.has(locale)) cache.set(locale, getFormatters(locale));
  return cache.get(locale);
}

// Formats (dates, nombres, monnaies) dans la langue courante.
// Composant serveur (non async) ou client : const f = useFormat(); f.date(item.created_at)
// Composant serveur async : const f = formattersFor(locale).
export function useFormat() {
  return formattersFor(useLocale());
}

export { getFormatters };
