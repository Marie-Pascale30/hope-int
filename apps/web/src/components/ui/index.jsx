"use client";

// Composants d'interface partages (styles dans src/styles/globals.css).
import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, Inbox, Search, X } from "lucide-react";
import { initials as toInitials } from "../../utils/format";

const cx = (...classes) => classes.filter(Boolean).join(" ");

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

export function Field({ label, hint, error, required, full, htmlFor, children, className }) {
  return (
    <div className={cx("field", full && "field--full", className)}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? <span className="field__error" role="alert">{error}</span> : hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

function useFieldId(id) {
  const generated = useId();
  return id || generated;
}

export function Input({ label, hint, error, full, required, id, className, ...props }) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} full={full} htmlFor={inputId}>
      <input id={inputId} className={cx("input", className)} required={required} aria-invalid={error ? "true" : undefined} {...props} />
    </Field>
  );
}

export function Textarea({ label, hint, error, full, required, id, className, ...props }) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} full={full} htmlFor={inputId}>
      <textarea id={inputId} className={cx("textarea", className)} required={required} aria-invalid={error ? "true" : undefined} {...props} />
    </Field>
  );
}

// options : [{ value, label }] ; placeholder ajoute une option vide
export function Select({ label, hint, error, full, required, id, options = [], placeholder, className, ...props }) {
  const inputId = useFieldId(id);
  return (
    <Field label={label} hint={hint} error={error} required={required} full={full} htmlFor={inputId}>
      <select id={inputId} className={cx("select", className)} required={required} aria-invalid={error ? "true" : undefined} {...props}>
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
  const toggle = (optionValue) => {
    if (!multiple) return onChange(optionValue);
    onChange(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
  };
  return (
    <Field label={label} hint={hint} error={error} full={full}>
      <div className="choice-group" role="group" aria-label={typeof label === "string" ? label : undefined}>
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

export function Spinner({ small }) {
  return <span className={cx("spinner", small && "spinner--sm")} role="status" aria-label="Chargement" />;
}

export function LoadingState({ label = "Chargement…" }) {
  return (
    <div className="state" aria-live="polite">
      <Spinner />
      <span className="muted">{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = "Rien à afficher", description, action }) {
  return (
    <div className="state">
      <span className="state__icon"><Icon size={24} aria-hidden="true" /></span>
      <span className="state__title">{title}</span>
      {description && <p className="muted" style={{ maxWidth: 440, margin: 0 }}>{description}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Chargement impossible", message, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon"><AlertCircle size={24} aria-hidden="true" /></span>
      <span className="state__title">{title}</span>
      {message && <p className="muted" style={{ maxWidth: 440, margin: 0 }}>{message}</p>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Réessayer</Button>}
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
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className={cx("progress", accent && "progress--accent")}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || "Progression"}
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

// tabs : [{ value, label, count? }]
export function Tabs({ tabs, value, onChange, label = "Onglets" }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          className="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="tab__count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------- Modale ----------

export function Modal({ open, title, onClose, children, footer, large }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("input, select, textarea, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div ref={dialogRef} className={cx("modal", large && "modal--lg")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h2>{title}</h2>
          <Button variant="ghost" icon={X} onClick={onClose} aria-label="Fermer" />
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Tableau de donnees ----------
// columns : [{ key, header, render?(row), sortValue?(row), className?, sortable? }]
// searchKeys : champs (ou fonction row => texte) utilises par la recherche
export function DataTable({
  columns,
  rows = [],
  searchKeys,
  searchPlaceholder = "Rechercher…",
  toolbar,
  pageSize = 15,
  emptyTitle = "Aucun résultat",
  emptyDescription,
  onRowClick,
  rowKey = (row) => row.id,
  initialSort,
}) {
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
      const result = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fr");
      return sort.dir === "asc" ? result : -result;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const toggleSort = (key) => {
    setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  return (
    <div>
      {(searchKeys || toolbar) && (
        <div className="table-toolbar">
          {searchKeys && (
            <div style={{ position: "relative", flex: "0 1 300px" }}>
              <Search size={16} aria-hidden="true" style={{ position: "absolute", left: 12, top: 14, color: "var(--ink-3)" }} />
              <input
                className="input"
                style={{ paddingLeft: 36, width: "100%" }}
                type="search"
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
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
        <div className="table-wrap"><EmptyState title={emptyTitle} description={emptyDescription} /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={column.className} scope="col">
                    {column.sortable ? (
                      <button type="button" onClick={() => toggleSort(column.key)}>
                        {column.header}
                        {sort?.key === column.key && (sort.dir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={onRowClick ? "is-clickable" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={column.className}>
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
        <div className="pagination">
          <span>
            {currentPage * pageSize + 1}–{Math.min(sorted.length, (currentPage + 1) * pageSize)} sur {sorted.length}
          </span>
          <div className="row">
            <Button size="sm" variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
              Précédent
            </Button>
            <Button size="sm" variant="secondary" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
