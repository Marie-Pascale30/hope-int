"use client";

// Tableau de donnees : recherche, tri, pagination, selection, affichage en cartes sur mobile.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronsUpDown, ChevronUp, Search } from "lucide-react";
import { Button } from "./Button";
import { EmptyState } from "./Feedback";
import { cx } from "./utils";

// columns : [{ key, header, label?, render?(row), sortValue?(row), className?, sortable? }]
//   label : libelle texte de la colonne (affichage en cartes sur mobile) si header n'est pas une chaine.
// searchKeys : champs (ou fonction row => texte) utilises par la recherche
// search / onSearchChange : recherche controlee par le parent (ex. conservee dans l'URL) ;
//   sans ces props, la saisie reste interne au tableau.
// onRowClick : ligne activable a la souris et au clavier (Entree / Espace) ; rowLabel(row) nomme l'action.
// stacked : sous 768 px, chaque ligne devient une carte (libelle de colonne devant chaque valeur).
// selectable : cases de selection (une par ligne + "tout selectionner" sur la page affichee) ;
//   selectedIds / onSelectionChange(ids) : selection controlee ; isSelectable(row) exclut des lignes ;
//   selectLabel(row) : nom de la ligne pour la case (ex. nom de la personne) ;
//   bulkActions(selectedRows, clear) : barre d'actions affichee des qu'une ligne est cochee.
// Le champ de recherche porte data-page-search : la touche "/" lui donne le focus (raccourcis admin).
export function DataTable({
  columns,
  rows = [],
  searchKeys,
  searchPlaceholder,
  search,
  onSearchChange,
  toolbar,
  pageSize = 15,
  emptyTitle,
  emptyDescription,
  onRowClick,
  rowLabel,
  rowKey = (row) => row.id,
  initialSort,
  stacked = true,
  caption,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  isSelectable = () => true,
  selectLabel,
  bulkActions,
}) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const searchLabel = searchPlaceholder ?? t("search");
  const [innerQuery, setInnerQuery] = useState("");
  const controlled = typeof onSearchChange === "function";
  const query = controlled ? search ?? "" : innerQuery;
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState(initialSort || null); // { key, dir: 'asc' | 'desc' }
  const selectAllRef = useRef(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term || !searchKeys) return rows;
    return rows.filter((row) => {
      const haystack = typeof searchKeys === "function"
        ? searchKeys(row)
        : searchKeys.map((key) => row[key]).join(" ");
      return String(haystack || "").toLowerCase().includes(term);
    });
  }, [rows, query, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((col) => col.key === sort.key);
    if (!column) return filtered;
    const getValue = column.sortValue || ((row) => row[column.key]);
    return [...filtered].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const result = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), locale);
      return sort.dir === "asc" ? result : -result;
    });
  }, [filtered, sort, columns, locale]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  // Selection : seules les lignes encore presentes comptent (apres rechargement ou filtrage).
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectableVisible = selectable ? visible.filter((row) => isSelectable(row)) : [];
  const visibleSelected = selectableVisible.filter((row) => selectedSet.has(rowKey(row)));
  const allVisibleSelected = selectableVisible.length > 0 && visibleSelected.length === selectableVisible.length;
  const someVisibleSelected = visibleSelected.length > 0 && !allVisibleSelected;
  const selectedRows = selectable ? rows.filter((row) => selectedSet.has(rowKey(row))) : [];

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  const setSelection = (ids) => onSelectionChange?.([...new Set(ids)]);
  const toggleRow = (row) => {
    const key = rowKey(row);
    setSelection(selectedSet.has(key) ? selectedIds.filter((id) => id !== key) : [...selectedIds, key]);
  };
  const toggleVisible = () => {
    const keys = selectableVisible.map(rowKey);
    setSelection(allVisibleSelected ? selectedIds.filter((id) => !keys.includes(id)) : [...selectedIds, ...keys]);
  };
  const clearSelection = () => setSelection([]);

  const toggleSort = (key) => {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  const changeQuery = (value) => {
    if (controlled) onSearchChange(value);
    else setInnerQuery(value);
    setPage(0);
  };

  const columnLabel = (column) => column.label ?? (typeof column.header === "string" ? column.header : undefined);

  const activateRow = (event, row) => {
    // Seule la ligne elle-meme reagit : les boutons et liens internes gardent leur comportement.
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div>
      {(searchKeys || toolbar) && (
        <div className="table-toolbar">
          {searchKeys && (
            <div className="table-search">
              <Search size={16} aria-hidden="true" className="table-search__icon" />
              <input
                className="input"
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                data-page-search=""
                placeholder={searchLabel}
                aria-label={searchLabel}
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      {selectable && selectedRows.length > 0 && (
        <div className="bulk-bar" role="region" aria-label={t("bulk.label")}>
          <span className="bulk-bar__count" aria-live="polite">{t("bulk.selected", { count: selectedRows.length })}</span>
          <div className="bulk-bar__actions">
            {bulkActions?.(selectedRows, clearSelection)}
            <Button size="sm" variant="ghost" onClick={clearSelection}>{t("bulk.clear")}</Button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="table-wrap" role="status"><EmptyState title={emptyTitle ?? t("noResults")} description={emptyDescription} /></div>
      ) : (
        <div className={cx("table-wrap", stacked && "table-wrap--stack")}>
          <table className={cx("table", stacked && "table--stack", selectable && "table--selectable")}>
            {caption && <caption className="visually-hidden">{caption}</caption>}
            <thead>
              <tr>
                {selectable && (
                  <th scope="col" className="table__select">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allVisibleSelected}
                      disabled={!selectableVisible.length}
                      onChange={toggleVisible}
                      aria-label={t("bulk.selectPage")}
                    />
                  </th>
                )}
                {columns.map((column) => {
                  const isSorted = sort?.key === column.key;
                  const ariaSort = column.sortable ? (isSorted ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined;
                  const SortIcon = isSorted ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
                  return (
                    <th key={column.key} className={column.className} scope="col" aria-sort={ariaSort}>
                      {column.sortable ? (
                        <button type="button" onClick={() => toggleSort(column.key)}>
                          {column.header}
                          <SortIcon size={14} aria-hidden="true" className={isSorted ? undefined : "table__sort-idle"} />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const key = rowKey(row);
                const checked = selectedSet.has(key);
                return (
                  <tr
                    key={key}
                    className={cx(onRowClick && "is-clickable", checked && "is-selected")}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (event) => activateRow(event, row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                  >
                    {selectable && (
                      <td className="table__select" onClick={(event) => event.stopPropagation()}>
                        {isSelectable(row) && (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRow(row)}
                            onKeyDown={(event) => event.stopPropagation()}
                            aria-label={t("bulk.selectRow", { label: selectLabel ? selectLabel(row) : String(key) })}
                          />
                        )}
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.key} className={column.className} data-label={columnLabel(column)}>
                        {column.render ? column.render(row) : row[column.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > pageSize && (
        <nav className="pagination" aria-label={t("pagination")}>
          <span aria-live="polite">
            {t("range", { from: currentPage * pageSize + 1, to: Math.min(sorted.length, (currentPage + 1) * pageSize), total: sorted.length })}
          </span>
          <div className="row">
            <Button size="sm" variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
              {t("previous")}
            </Button>
            <Button size="sm" variant="secondary" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>
              {t("next")}
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
