"use client";

import { useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, PageSkeleton, PageHeader, Select } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { useFormat } from "../../i18n/format";
import { adminApi } from "../../services";
import { useErrorMessage } from "../../i18n/errors";
import { useLabels } from "../../utils/labels";
import { PERMISSIONS as P } from "../../utils/rbac";

const PAGE_SIZE = 50;

// Domaines d'action (prefixe avant le premier point), filtrables cote API (LIKE "domaine.%").
const CATEGORIES = ["auth", "admin", "hr", "payment", "finance", "application", "message", "content", "event", "email"];

const TONES = { auth: "info", admin: "accent", hr: "accent", payment: "success", finance: "success" };
const actionTone = (action) => {
  if (/failed|mismatch|disputed|dispute_lost|revoked|inactive/.test(action)) return "danger";
  if (/delete|review$|refunded|abandoned/.test(action)) return "warning";
  return TONES[String(action).split(".")[0]] || "brand";
};

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

// Libelle d'une action : messages "adminOps.logs.actions.<domaine>.<verbe>[.<type>]",
// avec un repli lisible (domaine connu + code brut) pour une action non repertoriee.
function useActionLabel() {
  const t = useTranslations("adminOps.logs");
  return (action) => {
    const key = `actions.${action}`;
    const parts = String(action || "").split(".");
    if (parts.every(Boolean) && t.has(key) && typeof t.raw(key) === "string") return t(key);
    const domain = parts[0];
    if (CATEGORIES.includes(domain)) return t("unknownInDomain", { domain: t(`categories.${domain}`) });
    return t("unknown");
  };
}

// Resume lisible des informations utiles du detail (le JSON brut reste consultable).
function useMetaSummary() {
  const t = useTranslations("adminOps.logs.meta");
  const labels = useLabels();
  const f = useFormat();
  return (action, meta) => {
    if (!isObject(meta)) return [];
    const lines = [];
    if (isObject(meta.status) && "from" in meta.status) {
      lines.push(t("statusChange", {
        from: labels.status("userStatus", meta.status.from).label,
        to: labels.status("userStatus", meta.status.to).label,
      }));
    }
    if (action === "admin.update_user_roles" && Array.isArray(meta.to)) {
      lines.push(t("rolesChange", {
        from: (Array.isArray(meta.from) ? meta.from : []).map(labels.role).join(", ") || "—",
        to: meta.to.map(labels.role).join(", ") || "—",
      }));
    }
    if (action === "admin.create_user" && Array.isArray(meta.roles)) {
      lines.push(t("roles", { roles: meta.roles.map(labels.role).join(", ") }));
    }
    if (Array.isArray(meta.fields) && meta.fields.length) lines.push(t("fields", { fields: meta.fields.join(", ") }));
    if (meta.targetUserId) lines.push(t("targetUser", { id: meta.targetUserId }));
    if (meta.paymentId) lines.push(t("payment", { id: meta.paymentId }));
    if (meta.amount !== undefined && meta.currency) lines.push(t("amount", { amount: f.money(meta.amount, meta.currency) }));
    if (isObject(meta.expected) && isObject(meta.received)) {
      lines.push(t("mismatch", {
        expected: f.money(meta.expected.amount, meta.expected.currency),
        received: meta.received.currency ? f.money(meta.received.amount, meta.received.currency) : String(meta.received.amount ?? "—"),
      }));
    }
    if (meta.receiptNumber) lines.push(t("receipt", { number: meta.receiptNumber }));
    if (meta.previous) lines.push(t("previousStatus", { status: labels.status("paymentStatus", meta.previous).label }));
    if (meta.note) lines.push(t("note", { note: meta.note }));
    if (action === "finance.reconcile" && meta.checked !== undefined) {
      lines.push(t("reconcile", {
        checked: Number(meta.checked) || 0,
        succeeded: Number(meta.succeeded) || 0,
        recovered: Number(meta.recovered) || 0,
        review: Number(meta.review) || 0,
        failed: Number(meta.failed) || 0,
        abandoned: Number(meta.abandoned) || 0,
        errors: Number(meta.errors) || 0,
      }));
    }
    if (action === "finance.export_donations" && meta.rows !== undefined) lines.push(t("rows", { count: Number(meta.rows) || 0 }));
    if (action === "event.view_registrations" && meta.count !== undefined) lines.push(t("registrations", { count: Number(meta.count) || 0 }));
    if (action === "event.delete" && meta.registrations !== undefined) {
      lines.push(t("eventDeleted", { title: meta.title || "—", count: Number(meta.registrations) || 0 }));
    }
    if (action === "email.failed") {
      if (meta.to) lines.push(t("recipient", { to: meta.to }));
      if (meta.attempts !== undefined) lines.push(t("attempts", { count: Number(meta.attempts) || 0 }));
    }
    return lines;
  };
}

function MetaDetails({ action, meta }) {
  const t = useTranslations("adminOps.logs");
  const summarize = useMetaSummary();
  if (!meta || (typeof meta === "object" && !Object.keys(meta).length)) return <span className="muted">—</span>;
  const lines = summarize(action, meta);
  const text = typeof meta === "string" ? meta : JSON.stringify(meta, null, 2);
  return (
    <>
      {lines.length > 0 && (
        <div className="cell-main">
          {lines.map((line) => <span key={line}>{line}</span>)}
        </div>
      )}
      <details className="adm-meta">
        <summary>{t("details")}</summary>
        <pre>{text}</pre>
      </details>
    </>
  );
}

function Journal() {
  const getErrorMessage = useErrorMessage();
  const t = useTranslations("adminOps.logs");
  const f = useFormat();
  const actionLabel = useActionLabel();
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);
  const { data, loading, error, reload } = useAsync(
    () => adminApi.logs({ limit: PAGE_SIZE, offset, action: action || undefined }),
    [offset, action]
  );

  const total = data?.total || 0;
  const items = data?.items || [];
  const categoryOptions = CATEGORIES.map((value) => ({ value, label: t(`categories.${value}`) }));

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={<Button variant="secondary" icon={RefreshCw} loading={loading} onClick={reload}>{t("refresh")}</Button>}
      />

      <div className="table-toolbar">
        <Select
          label={t("filter")}
          placeholder={t("allActions")}
          options={categoryOptions}
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setOffset(0);
          }}
        />
        {!loading && !error && <span className="muted adm-small adm-toolbar-note">{t("entries", { count: total })}</span>}
      </div>

      {loading && !data ? (
        <PageSkeleton variant="table" columns={4} rows={8} label={t("loading")} />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : !items.length ? (
        <EmptyState
          icon={ScrollText}
          title={t("empty.title")}
          description={action ? t("empty.filtered") : t("empty.text")}
        />
      ) : (
        <>
          <div className="table-wrap" aria-busy={loading}>
            <table className="table adm-logs">
              <thead>
                <tr>
                  <th scope="col">{t("columns.date")}</th>
                  <th scope="col">{t("columns.action")}</th>
                  <th scope="col">{t("columns.author")}</th>
                  <th scope="col">{t("columns.details")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="adm-nowrap">
                      <div className="cell-main">
                        <strong>{f.dateTime(item.created_at)}</strong>
                        <span>{f.relative(item.created_at)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-main">
                        <strong><span className={`adm-dot adm-dot--${actionTone(item.action)}`} aria-hidden="true" />{actionLabel(item.action)}</strong>
                        <span className="adm-mono">{item.action}</span>
                      </div>
                    </td>
                    <td>
                      {item.user_id ? (
                        <div className="cell-main">
                          <strong>{item.user_name || t("account", { id: item.user_id })}</strong>
                          <span>{item.user_email || t("deletedAccount")}</span>
                        </div>
                      ) : (
                        <span className="muted">{t("system")}</span>
                      )}
                    </td>
                    <td><MetaDetails action={item.action} meta={item.meta} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              {t("pagination", {
                from: f.number(offset + 1),
                to: f.number(Math.min(total, offset + items.length)),
                total: f.number(total),
              })}
            </span>
            <div className="row">
              <Button size="sm" variant="secondary" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                {t("newer")}
              </Button>
              <Button size="sm" variant="secondary" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>
                {t("older")}
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default function Logs() {
  return (
    <RequireAuth permission={P.VIEW_LOGS}>
      <Journal />
    </RequireAuth>
  );
}
