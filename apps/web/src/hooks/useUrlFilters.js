"use client";

// Filtres, recherche et page d'une liste conserves dans l'URL (?status=new&page=2&q=...) :
// la vue survit a un rechargement, se partage par lien et suit les boutons precedent / suivant.
//
//   const { values, setValues, reset, hasFilters } = useUrlFilters({ status: "", q: "", page: 1 });
//   setValues({ status: "new" })      -> remet la page a 1 (sauf si `page` est fourni)
//   setValues({ page: 3 })
//
// Les valeurs par defaut sont absentes de l'URL ; un nombre par defaut (page) est relu en nombre.
// La page appelante doit etre rendue sous un <Suspense> (exigence de useSearchParams).
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useUrlFilters(defaults) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Les valeurs par defaut sont des constantes de module : la cle stabilise les memos.
  const defaultsKey = JSON.stringify(defaults);

  const values = useMemo(() => {
    const base = JSON.parse(defaultsKey);
    return Object.fromEntries(Object.entries(base).map(([key, fallback]) => {
      const raw = params.get(key);
      if (raw === null) return [key, fallback];
      if (typeof fallback === "number") {
        const number = Number(raw);
        return [key, Number.isFinite(number) && number > 0 ? number : fallback];
      }
      return [key, raw];
    }));
  }, [params, defaultsKey]);

  const navigate = useCallback((next) => {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [router, pathname]);

  const setValues = useCallback((patch) => {
    const base = JSON.parse(defaultsKey);
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([key, value]) => {
      const empty = value === undefined || value === null || value === "";
      if (empty || String(value) === String(base[key] ?? "")) next.delete(key);
      else next.set(key, String(value));
    });
    if (!("page" in patch) && "page" in base) next.delete("page");
    navigate(next);
  }, [params, defaultsKey, navigate]);

  // Retire tous les filtres geres (les autres parametres de l'URL sont conserves).
  const reset = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    Object.keys(JSON.parse(defaultsKey)).forEach((key) => next.delete(key));
    navigate(next);
  }, [params, defaultsKey, navigate]);

  const hasFilters = Object.entries(values).some(([key, value]) => key !== "page" && value !== JSON.parse(defaultsKey)[key]);

  return { values, setValues, reset, hasFilters };
}
