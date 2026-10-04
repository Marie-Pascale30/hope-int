"use client";

// Composants d'interface partages (styles dans src/styles/globals.css).
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronsUpDown, ChevronUp, Info, Inbox, Search, X,
} from "lucide-react";
import { initials as toInitials } from "../../utils/format";

const cx = (...classes) => classes.filter(Boolean).join(" ");

// Elements atteignables au clavier (piege de focus des modales, premier champ...).
const FOCUSABLE = [
  "a[href]", "area[href]", "button:not([disabled])", "input:not([disabled]):not([type=\"hidden\"])",
  "select:not([disabled])", "textarea:not([disabled])", "iframe", "[tabindex]:not([tabindex=\"-1\"])",
  "[contenteditable=\"true\"]",
].join(",");

const isVisible = (element) => element.getClientRects().length > 0;

export function getFocusable(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE)].filter((element) => isVisible(element) && !element.closest("[inert]"));
}

// Met le focus sur le premier champ invalide d'un formulaire (apres le rendu des erreurs).
// Cible les elements aria-invalid="true" ou data-invalid="true" (groupes : premier champ du groupe).
export function focusFirstInvalid(container) {
  if (typeof window === "undefined" || !container) return;
  window.requestAnimationFrame(() => {
    const target = container.querySelector("[aria-invalid=\"true\"], [data-invalid=\"true\"]");
    if (!target) return;
    // Un groupe focalisable (tabindex) recoit le focus lui-meme ; sinon son premier champ.
    const focusable = target.matches(FOCUSABLE) || target.hasAttribute("tabindex")
      ? target
      : getFocusable(target).find((element) => element.tagName !== "IFRAME") || target;
    if (!focusable.matches(FOCUSABLE) && !focusable.hasAttribute("tabindex")) focusable.setAttribute("tabindex", "-1");
    focusable.focus();
    if (typeof focusable.scrollIntoView === "function") {
      focusable.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  });
}

// ---------- Boutons ----------

export function Button({ href, variant, size, block, icon: Icon, iconRight: IconRight, loading, className, children, ...props }) {
  const classes = cx(
    "btn",
    variant && `btn--${variant}`,
    size && `btn--${size}`,
    block && "btn--block",
    !children && Icon && "btn--icon",
    className
  );
  const content = (
    <>
      {loading ? <span className="spinner spinner--sm" aria-hidden="true" /> : Icon && <Icon aria-hidden="true" />}
      {children}
      {IconRight && <IconRight aria-hidden="true" />}
    </>
  );
  if (href) {
    const external = /^https?:\/\//.test(href);
    return external ? (
      <a href={href} className={classes} {...props}>{content}</a>
    ) : (
      <Link href={href} className={classes} {...props}>{content}</Link>
    );
  }
  return (
    <button type="button" className={classes} disabled={loading || props.disabled} {...props}>
      {content}
    </button>
  );
}

// ---------- Badges ----------

export function Badge({ tone, plain, children, className }) {
  return <span className={cx("badge", tone && `badge--${tone}`, plain && "badge--plain", className)}>{children}</span>;
}

// status : objet { label, tone } issu de utils/labels.js
export function StatusBadge({ status }) {
  if (!status) return null;
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

// ---------- Conteneurs ----------

export function Card({ as: Tag = "div", pad = true, hover, className, children, ...props }) {
  return (
    <Tag className={cx("card", pad && "card--pad", hover && "card--hover", className)} {...props}>
      {children}
    </Tag>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__desc">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

// ---------- Formulaires ----------

// Identifiants de l'aide et de l'erreur d'un champ (pour aria-describedby).
export function fieldDescriptionIds(id, { hint, error } = {}) {
  if (!id) return undefined;
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

const joinIds = (...ids) => ids.filter(Boolean).join(" ") || undefined;

// htmlFor : id du controle ; sert aussi de base aux id de l'aide et de l'erreur.
export function Field({ label, hint, error, required, full, htmlFor, labelId, children, className }) {
  const describedBy = htmlFor || labelId;
  return (
    <div className={cx("field", full && "field--full", className)}>
      {label && (
        <label className="field__label" htmlFor={htmlFor} id={labelId}>
          {label}
          {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error" id={describedBy ? `${describedBy}-error` : undefined} role="alert">{error}</span>
      ) : (
        hint && <span className="field__hint" id={describedBy ? `${describedBy}-hint` : undefined}>{hint}</span>
      )}
    </div>
  );
}

function useFieldId(id) {
  const generated = useId();
  return id || generated;
}

// Attributs d'accessibilite communs aux controles (aria-invalid, aria-describedby).
function controlA11y(inputId, { hint, error, describedBy }) {
  return {
    "aria-invalid": error ? "true" : undefined,
    "aria-describedby": joinIds(fieldDescriptionIds(inputId, { hint, error }), describedBy),
  };
}

export function Input({ label, hint, error, full, required, id, className, "aria-describedby": describedBy, ...props }) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} full={full} htmlFor={inputId}>
      <input id={inputId} className={cx("input", className)} required={required} {...controlA11y(inputId, { hint, error, describedBy })} {...props} />
    </Field>
  );
}

export function Textarea({ label, hint, error, full, required, id, className, "aria-describedby": describedBy, ...props }) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} full={full} htmlFor={inputId}>
      <textarea id={inputId} className={cx("textarea", className)} required={required} {...controlA11y(inputId, { hint, error, describedBy })} {...props} />
    </Field>
  );
}

// options : [{ value, label }] ; placeholder ajoute une option vide
export function Select({ label, hint, error, full, required, id, options = [], placeholder, className, "aria-describedby": describedBy, ...props }) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} full={full} htmlFor={inputId}>
      <select id={inputId} className={cx("select", className)} required={required} {...controlA11y(inputId, { hint, error, describedBy })} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

// Choix multiples sous forme de puces cliquables (remplace les <select multiple>).
export function ChoiceGroup({ label, hint, error, full, options = [], value = [], onChange, multiple = true, name, disabledValues = [] }) {
  const groupName = useFieldId(name);
  const labelId = `${groupName}-label`;
  const toggle = (optionValue) => {
    if (!multiple) return onChange(optionValue);
    onChange(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
  };
  return (
    <Field label={label} hint={hint} error={error} full={full} labelId={label ? labelId : undefined}>
      <div
        className="choice-group"
        role="group"
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={fieldDescriptionIds(labelId, { hint, error })}
        data-invalid={error ? "true" : undefined}
      >
        {options.map((option) => {
          const checked = multiple ? value.includes(option.value) : value === option.value;
          return (
            <label key={option.value} className="choice">
              <input
                type={multiple ? "checkbox" : "radio"}
                name={groupName}
                checked={checked}
                disabled={disabledValues.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </Field>
  );
}

export function Switch({ label, checked, onChange, ...props }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} {...props} />
      {label}
    </label>
  );
}

// ---------- Etats ----------

export function Spinner({ small, label }) {
  const t = useTranslations("ui");
  return <span className={cx("spinner", small && "spinner--sm")} role="status" aria-label={label ?? t("loadingShort")} />;
}

export function LoadingState({ label }) {
  const t = useTranslations("ui");
  return (
    <div className="state" role="status" aria-live="polite">
      <span className={cx("spinner")} aria-hidden="true" />
      <span className="muted">{label ?? t("loading")}</span>
    </div>
  );
}

// ---------- Squelettes de chargement ----------
// Blocs decoratifs (aria-hidden) ; le conteneur annonce le chargement aux lecteurs d'ecran.

function SkeletonRegion({ label, className, children }) {
  const t = useTranslations("ui");
  return (
    <div className={cx("skeleton-region", className)} role="status" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">{label ?? t("loading")}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function SkeletonLine({ width = "100%", height = 12, className }) {
  return <span className={cx("skeleton skeleton-line", className)} style={{ width, height }} />;
}

function SkeletonStatsBlock({ count = 4 }) {
  return (
    <div className="skeleton-stats">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="stat skeleton-stat">
          <div className="stat__top">
            <SkeletonLine width="55%" />
            <span className="skeleton skeleton-stat__icon" />
          </div>
          <SkeletonLine width="70%" height={28} />
          <SkeletonLine width="45%" height={10} />
        </div>
      ))}
    </div>
  );
}

const CELL_WIDTHS = ["70%", "45%", "60%", "35%", "50%", "40%"];

function SkeletonTableBlock({ rows = 6, columns = 4, toolbar = true }) {
  return (
    <div>
      {toolbar && (
        <div className="table-toolbar">
          <span className="skeleton skeleton-input" />
        </div>
      )}
      <div className="table-wrap skeleton-table">
        <div className="skeleton-table__head">
          {Array.from({ length: columns }, (_, index) => <SkeletonLine key={index} width="50%" height={10} />)}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="skeleton-table__row" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }, (_, col) => (
              <SkeletonLine key={col} width={CELL_WIDTHS[(row + col) % CELL_WIDTHS.length]} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonPanelsBlock({ count = 2, chart = true }) {
  return (
    <div className="admin-panels">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="panel">
          <SkeletonLine width="40%" height={16} />
          <SkeletonLine width="65%" height={10} className="skeleton-line--gap" />
          {chart ? <div className="skeleton skeleton-chart" /> : (
            <div className="skeleton-list">
              {Array.from({ length: 4 }, (_, line) => <SkeletonLine key={line} height={40} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4, label }) {
  const t = useTranslations("ui");
  return <SkeletonRegion label={label ?? t("loadingStats")}><SkeletonStatsBlock count={count} /></SkeletonRegion>;
}

export function SkeletonTable({ rows = 6, columns = 4, toolbar = true, label }) {
  const t = useTranslations("ui");
  return <SkeletonRegion label={label ?? t("loadingTable")}><SkeletonTableBlock rows={rows} columns={columns} toolbar={toolbar} /></SkeletonRegion>;
}

// Squelette de page d'administration.
// variant : "table" (liste), "stats-table" (indicateurs + liste), "dashboard" (indicateurs + panneaux),
// "panels" (panneaux seuls), "list" (cartes empilees).
export function PageSkeleton({ variant = "table", label, rows = 6, columns = 4, stats = 4 }) {
  return (
    <SkeletonRegion label={label} className="skeleton-page">
      {(variant === "stats-table" || variant === "dashboard") && <SkeletonStatsBlock count={stats} />}
      {(variant === "table" || variant === "stats-table") && <SkeletonTableBlock rows={rows} columns={columns} />}
      {variant === "dashboard" && <SkeletonPanelsBlock count={2} />}
      {variant === "panels" && <SkeletonPanelsBlock count={2} chart={false} />}
      {variant === "list" && (
        <div className="skeleton-list">
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="panel skeleton-list__item">
              <span className="skeleton skeleton-list__media" />
              <div className="skeleton-list__body">
                <SkeletonLine width="50%" height={14} />
                <SkeletonLine width="80%" height={10} />
              </div>
            </div>
          ))}
        </div>
      )}
    </SkeletonRegion>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  const t = useTranslations("ui");
  return (
    <div className="state">
      <span className="state__icon"><Icon size={24} aria-hidden="true" /></span>
      <span className="state__title">{title ?? t("empty")}</span>
      {description && <p className="muted" style={{ maxWidth: 440, margin: 0 }}>{description}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ title, message, onRetry, retryLabel }) {
  const t = useTranslations("ui");
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon"><AlertCircle size={24} aria-hidden="true" /></span>
      <span className="state__title">{title ?? t("errorTitle")}</span>
      {message && <p className="muted" style={{ maxWidth: 440, margin: 0 }}>{message}</p>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>{retryLabel ?? t("retry")}</Button>}
    </div>
  );
}

const ALERT_ICONS = { info: Info, warning: AlertTriangle, danger: AlertCircle, success: CheckCircle2 };

export function Alert({ tone = "info", title, children }) {
  const Icon = ALERT_ICONS[tone] || Info;
  return (
    <div className={`alert alert--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <Icon aria-hidden="true" />
      <div>
        {title && <strong style={{ display: "block", marginBottom: 2 }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

// ---------- Donnees ----------

export function ProgressBar({ value = 0, accent, label }) {
  const t = useTranslations("ui");
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className={cx("progress", accent && "progress--accent")}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || t("progress")}
    >
      <div className="progress__bar" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone }) {
  return (
    <div className={cx("stat", tone && `stat--${tone}`)}>
      <div className="stat__top">
        <span className="stat__label">{label}</span>
        {Icon && <span className="stat__icon"><Icon aria-hidden="true" /></span>}
      </div>
      <span className="stat__value">{value}</span>
      {hint && <span className="stat__hint">{hint}</span>}
    </div>
  );
}

export function Avatar({ name, large }) {
  return <span className={cx("avatar", large && "avatar--lg")} aria-hidden="true">{toInitials(name) || "?"}</span>;
}

// ---------- Onglets ----------
// tabs : [{ value, label, count? }]
// id : base des identifiants ; a partager avec <TabPanel tabsId={id} value={value}> qui
// enveloppe le contenu affiche (aria-controls / aria-labelledby).
// Clavier : fleches gauche/droite, Debut/Fin ; un seul onglet dans l'ordre de tabulation.

const tabDomId = (base, value) => `${base}-tab-${String(value).replace(/[^\w-]/g, "_")}`;
const panelDomId = (base) => `${base}-panel`;

export function Tabs({ tabs, value, onChange, label, id }) {
  const t = useTranslations("ui");
  const generated = useId();
  const base = id || generated;
  const listRef = useRef(null);

  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].value);
    listRef.current?.querySelector(`#${CSS.escape(tabDomId(base, tabs[next].value))}`)?.focus();
  };

  return (
    <div ref={listRef} className="tabs" role="tablist" aria-label={label ?? t("tabs")} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = value === tab.value;
        return (
          <button
            key={tab.value}
            id={tabDomId(base, tab.value)}
            type="button"
            role="tab"
            className="tab"
            aria-selected={selected}
            aria-controls={id ? panelDomId(base) : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="tab__count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Attributs du panneau associe a <Tabs id={tabsId}> (pour un conteneur existant).
export const tabPanelProps = (tabsId, value) => ({
  role: "tabpanel",
  id: panelDomId(tabsId),
  "aria-labelledby": tabDomId(tabsId, value),
});

export function TabPanel({ tabsId, value, className, children }) {
  return (
    <div {...tabPanelProps(tabsId, value)} className={className}>
      {children}
    </div>
  );
}

// ---------- Modale ----------
// Piege de focus, Echap, restauration du focus a la fermeture, titre relie par aria-labelledby.

export function Modal({ open, title, onClose, children, footer, large, closeLabel }) {
  const t = useTranslations("ui");
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const previous = document.activeElement;

    const onKey = (event) => {
      // Une boite de dialogue SweetAlert ouverte par-dessus gere elle-meme le clavier.
      if (document.querySelector(".swal2-container")) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = getFocusable(dialog);
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus initial : premier champ du contenu, sinon la boite elle-meme.
    const firstField = dialog?.querySelector(".modal__body input:not([type=\"hidden\"]):not([disabled]), .modal__body select, .modal__body textarea");
    (firstField || dialog)?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previous && typeof previous.focus === "function" && document.contains(previous)) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div
        ref={dialogRef}
        className={cx("modal", large && "modal--lg")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal__head">
          <h2 id={titleId}>{title}</h2>
          <Button variant="ghost" icon={X} onClick={onClose} aria-label={closeLabel ?? t("close")} />
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Tableau de donnees ----------
// columns : [{ key, header, label?, render?(row), sortValue?(row), className?, sortable? }]
//   label : libelle texte de la colonne (affichage en cartes sur mobile) si header n'est pas une chaine.
// searchKeys : champs (ou fonction row => texte) utilises par la recherche
// onRowClick : ligne activable a la souris et au clavier (Entree / Espace) ; rowLabel(row) nomme l'action.
// stacked : sous 768 px, chaque ligne devient une carte (libelle de colonne devant chaque valeur).
export function DataTable({
  columns,
  rows = [],
  searchKeys,
  searchPlaceholder,
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
}) {
  const t = useTranslations("ui");
  const locale = useLocale();
  const searchLabel = searchPlaceholder ?? t("search");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState(initialSort || null); // { key, dir: 'asc' | 'desc' }

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

  const toggleSort = (key) => {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
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
                placeholder={searchLabel}
                aria-label={searchLabel}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          )}
          {toolbar}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="table-wrap" role="status"><EmptyState title={emptyTitle ?? t("noResults")} description={emptyDescription} /></div>
      ) : (
        <div className={cx("table-wrap", stacked && "table-wrap--stack")}>
          <table className={cx("table", stacked && "table--stack")}>
            {caption && <caption className="visually-hidden">{caption}</caption>}
            <thead>
              <tr>
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
              {visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={onRowClick ? "is-clickable" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => activateRow(event, row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={column.className} data-label={columnLabel(column)}>
                      {column.render ? column.render(row) : row[column.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
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
