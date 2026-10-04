"use client";

// Pagination serveur des listes du back-office (?page=N&pageSize=M, M <= 100) :
// l'API renvoie alors { rows, total, page, pageSize } (sans "page" : tableau complet, forme historique).
import { useTranslations } from "next-intl";
import { Button } from "../../../components/ui";

export const PAGE_SIZE = 20;

// Accepte les deux formes de reponse.
export function toPage(result, pageSize = PAGE_SIZE) {
  if (Array.isArray(result)) return { rows: result, total: result.length, page: 1, pageSize: Math.max(pageSize, result.length) };
  return {
    rows: result?.rows || [],
    total: Number(result?.total) || 0,
    page: Number(result?.page) || 1,
    pageSize: Number(result?.pageSize) || pageSize,
  };
}

// Nombre total de lignes (sans les charger) : une page d'une ligne suffit.
export async function countOf(fetcher, params = {}) {
  return toPage(await fetcher({ ...params, page: 1, pageSize: 1 })).total;
}

export const pageCountOf = (total, pageSize) => Math.max(1, Math.ceil((Number(total) || 0) / pageSize));

export function ServerPagination({ page, pageSize, total, onChange, disabled = false }) {
  const t = useTranslations("admin.pagination");
  const pages = pageCountOf(total, pageSize);
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="pagination" aria-label={t("label")}>
      <span aria-live="polite">
        {t("range", { from, to, total })} · {t("page", { page, pages })}
      </span>
      <div className="row">
        <Button size="sm" variant="secondary" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
          {t("previous")}
        </Button>
        <Button size="sm" variant="secondary" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}>
          {t("next")}
        </Button>
      </div>
    </nav>
  );
}
