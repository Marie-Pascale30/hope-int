import { useLocale } from "next-intl";
import { createNavigation } from "next-intl/navigation";
import { localizePath } from "./config";
import { routing } from "./routing";

// Link, redirect, usePathname, useRouter conscients de la langue (prefixe ajoute automatiquement).
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

// Pour les composants qui attendent une URL texte (ex. <Button href>) :
// const lp = useLocalePath(); <Button href={lp("/don")}>
// Fonctionne dans les composants serveur (non async) et client.
export function useLocalePath() {
  const locale = useLocale();
  return (path) => localizePath(locale, path);
}
