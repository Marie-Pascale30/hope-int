"use client";

import { useMemo, useState } from "react";
import { Check, ClipboardCheck, Link2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Alert, Badge, Button, DataTable, EmptyState, ErrorState, PageSkeleton, Modal, PageHeader, StatusBadge, TabPanel, Tabs, Textarea,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useUrlFilters } from "../../hooks/useUrlFilters";
import { useFormat } from "../../i18n/format";
import { adminApi } from "../../services";
import { toast, useAlerts } from "../../utils/alerts";
import { truncate } from "../../utils/format";
import { STATUS_KEYS, useLabels } from "../../utils/labels";
import { can, PERMISSIONS as P } from "../../utils/rbac";
import RolePicker from "./components/RolePicker";
import TempPasswordModal from "./components/TempPasswordModal";
import { useErrorMessage } from "../../i18n/errors";
import { PAGE_SIZE, ServerPagination, countOf, toPage } from "./components/paging";
import { useRoleMatrix } from "./lib/roles";

const STATUSES = STATUS_KEYS.applicationStatus; // nouvelle, en_etude, acceptee, refusee
const TABS = [...STATUSES, "all"];

const isOpen = (application) => ["nouvelle", "en_etude"].includes(application.status);
// Onglet, recherche (dans la page) et page conserves dans l'URL.
const URL_DEFAULTS = { status: "nouvelle", q: "", page: 1 };
const BULK_MAX = 100;

// Refus groupe des candidatures cochees (POST /admin/applications/bulk-reject) avec note facultative.
function BulkRejectModal({ rows, onClose, onDone }) {
  const t = useTranslations("admin.applications.bulk");
  const tc = useTranslations("admin.common");
  const errorText = useErrorMessage();
  const { showError } = useAlerts();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await adminApi.bulkRejectApplications(rows.slice(0, BULK_MAX).map((row) => row.id), note.trim() || undefined);
      const rejected = Number(result?.rejected) || 0;
      const skipped = Array.isArray(result?.skipped) ? result.skipped.length : Number(result?.skipped) || 0;
      toast(skipped ? t("doneSkipped", { count: rejected, skipped }) : t("done", { count: rejected }), skipped ? "warning" : "success");
      onDone();
    } catch (err) {
      showError(t("failed"), errorText(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={t("title", { count: rows.length })}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{tc("cancel")}</Button>
          <Button variant="danger" icon={X} loading={busy} onClick={submit}>{t("confirm", { count: rows.length })}</Button>
        </>
      )}
    >
      <div className="stack">
        <Alert tone="warning">{t("text")}</Alert>
        <ul className="adm-bulk-list">
          {rows.slice(0, 8).map((row) => <li key={row.id}>{row.name} <span className="muted">· {row.email}</span></li>)}
          {rows.length > 8 && <li className="muted">{t("more", { count: rows.length - 8 })}</li>}
        </ul>
        <Textarea
          label={t("noteLabel")}
          hint={t("noteHint")}
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </Modal>
  );
}

// Poles d'interet (referentiel INTEREST_AREAS de @hope/shared/applications) : libelles dans "admin.interests".
function InterestBadges({ interests }) {
  const t = useTranslations("admin");
  if (!interests?.length) return <span className="muted">{t("applications.interestsNone")}</span>;
  return (
    <div className="chip-list">
      {interests.map((value) => (
        <Badge key={value} tone="brand" plain>{t.has(`interests.${value}`) ? t(`interests.${value}`) : value}</Badge>
      ))}
    </div>
  );
}

// Anciennes candidatures : roles demandes (historique, sans valeur de droit), en liste lisible.
function useRoleList() {
  const labels = useLabels();
  const f = useFormat();
  return (roles = []) => new Intl.ListFormat(f.locale, { type: "conjunction" }).format(roles.map((role) => labels.role(role)));
}

function ApplicationDetail({ application, user, matrix, onClose, onUpdated, onAccepted, onStale }) {
  const t = useTranslations("admin.applications");
  const tc = useTranslations("admin.common");
  const f = useFormat();
  const labels = useLabels();
  const errorText = useErrorMessage();
  const { confirmAction, showError } = useAlerts();
  const roleList = useRoleList();
  const canAccept = can(user, P.MANAGE_USER_ROLES);
  const [note, setNote] = useState(application.review_note || "");
  // Aucun role pre-coche : la personne qui accepte choisit explicitement.
  const [roles, setRoles] = useState([]);
  const [rolesError, setRolesError] = useState("");
  const [accountExists, setAccountExists] = useState(null);
  const [busy, setBusy] = useState(null);
  const open = isOpen(application);
  const legacyRoles = application.desired_roles || [];

  // Erreurs de decision : candidature deja cloturee (409, ou 400 renvoye avant la decision) -> liste rafraichie.
  const handleError = (err) => {
    const status = err?.response?.status;
    const data = err?.response?.data;
    if (status === 409 || (status === 400 && data?.error && !data?.errors)) {
      toast(data?.error || t("toasts.closed"), "warning");
      onStale();
      return;
    }
    showError(tc("actionFailed"), errorText(err));
  };

  const run = async (action, handler) => {
    setBusy(action);
    try {
      await handler();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(null);
    }
  };

  const review = () => run("review", async () => {
    onUpdated(await adminApi.reviewApplication(application.id, note.trim() || null));
    toast(t("toasts.reviewing"));
  });

  const reject = async () => {
    const ok = await confirmAction(
      t("rejectConfirm.title"),
      note.trim()
        ? t("rejectConfirm.textWithNote", { name: application.name })
        : t("rejectConfirm.textNoNote", { name: application.name }),
      t("rejectConfirm.button"),
      { danger: true }
    );
    if (!ok) return;
    run("reject", async () => {
      onUpdated(await adminApi.rejectApplication(application.id, note.trim() || null));
      toast(t("toasts.rejected"));
    });
  };

  // POST /admin/applications/:id/accept { roles: [>=1], reviewNote?, linkExisting? }
  const accept = (linkExisting = false) => {
    if (!roles.length) {
      setRolesError(t("detail.rolesRequired"));
      return;
    }
    setRolesError("");
    setBusy(linkExisting ? "link" : "accept");
    adminApi.acceptApplication(application.id, {
      roles,
      reviewNote: note.trim() || undefined,
      ...(linkExisting ? { linkExisting: true } : {}),
    })
      .then((result) => onAccepted(result))
      .catch((err) => {
        const data = err?.response?.data;
        if (err?.response?.status === 409 && data?.code === "ACCOUNT_EXISTS") {
          setAccountExists({ email: data.email || application.email });
          return;
        }
        handleError(err);
      })
      .finally(() => setBusy(null));
  };

  return (
    <Modal
      open
      large
      title={application.name}
      onClose={onClose}
      footer={open ? (
        <>
          {application.status === "nouvelle" && (
            <Button variant="secondary" icon={Search} loading={busy === "review"} disabled={Boolean(busy)} onClick={review}>
              {t("detail.review")}
            </Button>
          )}
          <Button variant="danger" icon={X} loading={busy === "reject"} disabled={Boolean(busy)} onClick={reject}>
            {t("detail.reject")}
          </Button>
          {canAccept && !accountExists && (
            <Button icon={Check} loading={busy === "accept"} disabled={Boolean(busy)} onClick={() => accept(false)}>
              {t("detail.accept")}
            </Button>
          )}
        </>
      ) : (
        <Button variant="secondary" onClick={onClose}>{tc("close")}</Button>
      )}
    >
      <div className="stack">
        <div className="row">
          <StatusBadge status={labels.status("applicationStatus", application.status)} />
          <span className="muted adm-small">
            {t("detail.received", { relative: f.relative(application.created_at), date: f.dateTime(application.created_at) })}
          </span>
        </div>

        <dl className="dl">
          <dt>{tc("email")}</dt>
          <dd><a href={`mailto:${application.email}`}>{application.email}</a></dd>
          <dt>{tc("phone")}</dt>
          <dd>{application.phone || "—"}</dd>
          <dt>{tc("region")}</dt>
          <dd>{application.region || "—"}</dd>
          <dt>{t("detail.interests")}</dt>
          <dd>
            <InterestBadges interests={application.interests} />
            {application.interests?.length > 0 && <span className="muted adm-small">{t("detail.interestsHint")}</span>}
          </dd>
          {legacyRoles.length > 0 && (
            <>
              <dt className="muted">{t("detail.legacyRoles")}</dt>
              <dd className="muted adm-small">{roleList(legacyRoles)}</dd>
            </>
          )}
          {application.reviewer_name && (
            <>
              <dt>{t("detail.reviewer")}</dt>
              <dd>{application.reviewer_name}</dd>
            </>
          )}
        </dl>

        <div>
          <h3 className="adm-subtitle">{t("detail.motivation")}</h3>
          <blockquote className="adm-quote">{application.motivation}</blockquote>
        </div>

        {open ? (
          <>
            <Textarea
              label={t("detail.note")}
              hint={t("detail.noteHint")}
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            {canAccept ? (
              <div className="adm-box">
                <RolePicker
                  user={user}
                  matrix={matrix}
                  value={roles}
                  onChange={(next) => {
                    setRoles(next);
                    if (next.length) setRolesError("");
                  }}
                  label={t("detail.rolesLabel")}
                  hint={t("detail.rolesHint")}
                  error={rolesError}
                />
                {accountExists && (
                  <div role="alert">
                    <Alert tone="warning" title={t("accountExists.title")}>
                      <p>{t("accountExists.text", { email: accountExists.email })}</p>
                      <div className="row">
                        <Button icon={Link2} loading={busy === "link"} disabled={Boolean(busy)} onClick={() => accept(true)}>
                          {t("accountExists.link")}
                        </Button>
                        <Button variant="ghost" disabled={Boolean(busy)} onClick={() => setAccountExists(null)}>
                          {t("accountExists.cancel")}
                        </Button>
                      </div>
                    </Alert>
                  </div>
                )}
              </div>
            ) : (
              <Alert tone="info">{t("detail.acceptReserved")}</Alert>
            )}
          </>
        ) : (
          application.review_note && (
            <div>
              <h3 className="adm-subtitle">{t("detail.note")}</h3>
              <p className="adm-note">{application.review_note}</p>
            </div>
          )
        )}
      </div>
    </Modal>
  );
}

// Pagination serveur : GET /admin/applications?status&page&pageSize -> { rows, total, page, pageSize }.
function ApplicationsInbox() {
  const t = useTranslations("admin.applications");
  const tc = useTranslations("admin.common");
  const f = useFormat();
  const labels = useLabels();
  const errorText = useErrorMessage();
  const roleList = useRoleList();
  const { user } = useAuth();
  const { values, setValues } = useUrlFilters(URL_DEFAULTS);
  const tab = TABS.includes(values.status) ? values.status : "nouvelle";
  const { page } = values;
  const setPage = (next) => setValues({ page: next });
  const viewKey = `${tab}-${page}`;
  const [checked, setChecked] = useState({ key: viewKey, ids: [] });
  const checkedIds = checked.key === viewKey ? checked.ids : [];
  const [bulkRows, setBulkRows] = useState(null);
  const { data, loading, error, reload, setData } = useAsync(
    async () => toPage(await adminApi.applications({ status: tab === "all" ? undefined : tab, page, pageSize: PAGE_SIZE })),
    [tab, page]
  );
  // Compteurs des onglets : total de chaque statut (pages d'une ligne).
  const { data: counts, reload: reloadCounts } = useAsync(async () => {
    const totals = await Promise.all(STATUSES.map((status) => countOf(adminApi.applications, { status })));
    const result = Object.fromEntries(STATUSES.map((status, index) => [status, totals[index]]));
    return { ...result, all: totals.reduce((sum, value) => sum + value, 0) };
  }, []);
  const { data: matrix } = useRoleMatrix();
  const [selectedId, setSelectedId] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const applications = useMemo(() => data?.rows || [], [data]);
  const total = data?.total || 0;
  const selected = applications.find((item) => item.id === selectedId);

  const changeTab = (value) => setValues({ status: value, q: values.q });

  const refresh = () => {
    reload();
    reloadCounts();
  };

  // Mise en etude / refus : ligne mise a jour sur place (la fiche reste ouverte), compteurs recharges.
  // La reponse (findById) ne porte pas le nom de l'examinateur : c'est l'utilisateur courant.
  const replace = (updated) => {
    setData((current) => ({
      ...current,
      rows: current.rows.map((item) => (
        item.id === updated.id ? { ...item, ...updated, reviewer_name: updated.reviewer_name || user.name } : item
      )),
    }));
    reloadCounts();
  };

  // Decision prise ailleurs : on ferme et on recharge.
  const handleStale = () => {
    setSelectedId(null);
    refresh();
  };

  const handleAccepted = (result) => {
    setSelectedId(null);
    refresh();
    if (result.linkedExisting) {
      toast(t("toasts.linked"));
    } else if (result.tempPassword) {
      setCredentials({ name: result.user.name, email: result.user.email, password: result.tempPassword });
    } else {
      toast(t("toasts.createdEmail"));
    }
  };

  const columns = [
    {
      key: "name",
      header: t("columns.candidate"),
      render: (row) => (
        <div className="cell-main">
          <strong>{row.name}</strong>
          <span>{row.email}</span>
        </div>
      ),
    },
    { key: "region", header: t("columns.region"), render: (row) => row.region || "—" },
    {
      key: "interests",
      header: t("columns.interests"),
      render: (row) => (row.interests?.length || !row.desired_roles?.length
        ? <InterestBadges interests={row.interests} />
        : (
          <span className="muted adm-small">{t("legacyRolesShort", { roles: roleList(row.desired_roles) })}</span>
        )),
    },
    {
      key: "motivation",
      header: t("columns.motivation"),
      render: (row) => <span className="adm-clip">{truncate(row.motivation, 90)}</span>,
    },
    {
      key: "created_at",
      header: t("columns.received"),
      render: (row) => <span title={f.dateTime(row.created_at)}>{f.relative(row.created_at)}</span>,
    },
    {
      key: "status",
      header: t("columns.status"),
      render: (row) => <StatusBadge status={labels.status("applicationStatus", row.status)} />,
    },
  ];

  let body;
  if (loading && !data) body = <PageSkeleton variant="table" columns={5} label={t("loading")} />;
  else if (error && !data) body = <ErrorState message={errorText(error)} onRetry={reload} />;
  else if (counts && counts.all === 0) {
    body = <EmptyState icon={ClipboardCheck} title={t("emptyTitle")} description={t("emptyText")} />;
  } else {
    body = (
      <>
        <Tabs
          id="applications-tabs"
          label={t("tabsLabel")}
          value={tab}
          onChange={changeTab}
          tabs={TABS.map((value) => ({ value, label: t(`tabs.${value}`), count: counts ? counts[value] : undefined }))}
        />
        <TabPanel tabsId="applications-tabs" value={tab}>
          <div aria-busy={loading}>
            {error && <ErrorState message={errorText(error)} onRetry={reload} />}
            <DataTable
              columns={columns}
              rows={applications}
              pageSize={Math.max(PAGE_SIZE, applications.length)}
              searchKeys={["name", "email", "region"]}
              searchPlaceholder={t("searchPlaceholder")}
              search={values.q}
              onSearchChange={(value) => setValues({ q: value, page })}
              caption={t("title")}
              selectable
              isSelectable={isOpen}
              selectedIds={checkedIds}
              onSelectionChange={(ids) => setChecked({ key: viewKey, ids })}
              bulkActions={(rows) => (
                <Button size="sm" variant="danger" icon={X} onClick={() => setBulkRows(rows)}>
                  {t("bulk.reject")}
                </Button>
              )}
              onRowClick={(row) => setSelectedId(row.id)}
              rowLabel={(row) => t("openRow", { name: row.name })}
              emptyTitle={t("emptyTab")}
              emptyDescription={tab === "nouvelle" && !total ? t("emptyTabNew") : undefined}
            />
            <ServerPagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} disabled={loading} />
          </div>
        </TabPanel>
        <p className="muted adm-small adm-hint">{t("rowHint")} {tc("pageSearchHint")}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {body}
      {selected && (
        <ApplicationDetail
          key={`${selected.id}-${selected.status}-${matrix ? "roles" : ""}`}
          application={selected}
          user={user}
          matrix={matrix}
          onClose={() => setSelectedId(null)}
          onUpdated={replace}

          onAccepted={handleAccepted}
          onStale={handleStale}
        />
      )}
      {bulkRows && (
        <BulkRejectModal
          rows={bulkRows}
          onClose={() => setBulkRows(null)}
          onDone={() => {
            setBulkRows(null);
            setChecked({ key: viewKey, ids: [] });
            refresh();
          }}
        />
      )}
      <TempPasswordModal credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}

export default function Applications() {
  return (
    <RequireAuth permission={P.MANAGE_APPLICATIONS}>
      <ApplicationsInbox />
    </RequireAuth>
  );
}
