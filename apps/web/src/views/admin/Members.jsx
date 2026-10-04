"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Save, Trash2, UserPlus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Alert, Avatar, Badge, Button, DataTable, EmptyState, ErrorState, Input, PageSkeleton, Modal, PageHeader, Select, tabPanelProps,
  StatusBadge, Switch, Tabs, Textarea,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { regionOptions, useMeta } from "../../hooks/useMeta";
import { useFormat } from "../../i18n/format";
import { adminApi } from "../../services";
import { toast, useAlerts } from "../../utils/alerts";
import { ROLE_KEYS, STATUS_KEYS, useLabels } from "../../utils/labels";
import { can, PERMISSIONS as P } from "../../utils/rbac";
import RolePicker from "./parts-a/RolePicker";
import TempPasswordModal from "./parts-a/TempPasswordModal";
import { useErrorMessage } from "../../i18n/errors";
import { PAGE_SIZE, ServerPagination, toPage } from "./parts-a/paging";
import { canGrantAll, useRoleMatrix } from "./parts-a/roles";

function RoleBadges({ roles }) {
  const labels = useLabels();
  return (
    <div className="chip-list">
      {(roles || []).map((role) => (
        <Badge key={role} tone={role === "membre" ? undefined : "brand"} plain>{labels.role(role)}</Badge>
      ))}
    </div>
  );
}

// ---------- Creation de compte ----------

function CreateUserModal({ user, matrix, regions, onClose, onCreated }) {
  const t = useTranslations("admin.members");
  const tc = useTranslations("admin.common");
  const errorText = useErrorMessage();
  const { showError } = useAlerts();
  const [form, setForm] = useState({ name: "", email: "", phone: "", region: "", roles: ["membre"] });
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    if (!form.roles.length) {
      showError(t("create.noRoleTitle"), t("create.noRoleText"));
      return;
    }
    setSaving(true);
    try {
      const result = await adminApi.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        region: form.region || undefined,
        roles: form.roles,
      });
      onCreated(result);
    } catch (err) {
      showError(t("create.failed"), errorText(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      large
      title={t("create.title")}
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>{tc("cancel")}</Button>
          <Button type="submit" form="adm-create-user" icon={UserPlus} loading={saving}>{t("create.submit")}</Button>
        </>
      )}
    >
      <form id="adm-create-user" className="form-grid" onSubmit={submit}>
        <Input label={t("create.name")} required minLength={2} maxLength={150} value={form.name} onChange={set("name")} autoComplete="off" />
        <Input label={tc("email")} type="email" required value={form.email} onChange={set("email")} autoComplete="off" />
        <Input label={tc("phone")} type="tel" maxLength={40} value={form.phone} onChange={set("phone")} placeholder={t("create.phonePlaceholder")} />
        <Select label={tc("region")} placeholder={tc("notProvided")} options={regions} value={form.region} onChange={set("region")} />
        <RolePicker user={user} matrix={matrix} value={form.roles} onChange={(roles) => setForm({ ...form, roles })} />
        <div className="field--full">
          <Alert tone="info">{t("create.info")}</Alert>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Fiche membre ----------

function RolesTab({ member, user, matrix, onSaved }) {
  const t = useTranslations("admin.members.rolesTab");
  const errorText = useErrorMessage();
  const { showError } = useAlerts();
  const [roles, setRoles] = useState(member.roles || []);
  const [saving, setSaving] = useState(false);
  const isSelf = Number(member.id) === Number(user.id);

  if (isSelf) {
    return <Alert tone="info" title={t("selfTitle")}>{t("selfText")}</Alert>;
  }
  if (matrix && !canGrantAll(user, matrix, member.roles)) {
    return <Alert tone="warning" title={t("forbiddenTitle")}>{t("forbiddenText")}</Alert>;
  }

  const unchanged = [...roles].sort().join() === [...(member.roles || [])].sort().join();

  const save = async () => {
    if (!roles.length) {
      showError(t("noRoleTitle"), t("noRoleText"));
      return;
    }
    setSaving(true);
    try {
      const result = await adminApi.updateUserRoles(member.id, roles);
      onSaved(result.user);
      toast(t("saved"));
    } catch (err) {
      showError(t("refused"), errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack">
      <RolePicker user={user} matrix={matrix} value={roles} onChange={setRoles} />
      <div className="row row--between">
        <span className="muted adm-small">{t("effectHint")}</span>
        <Button icon={Save} loading={saving} disabled={unchanged} onClick={save}>{t("save")}</Button>
      </div>
    </div>
  );
}

function HrTab({ member, user, regions, onSaved }) {
  const t = useTranslations("admin.members.hrTab");
  const tc = useTranslations("admin.common");
  const errorText = useErrorMessage();
  const { confirmAction, showError } = useAlerts();
  const [form, setForm] = useState({
    phone: member.phone || "",
    region: member.region || "",
    skills: member.skills || "",
    availability: member.availability || "",
    active: member.status !== "inactive",
  });
  const [saving, setSaving] = useState(false);
  const isSelf = Number(member.id) === Number(user.id);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const save = async (event) => {
    event.preventDefault();
    const status = form.active ? "active" : "inactive";
    if (status === "inactive" && member.status !== "inactive") {
      const ok = await confirmAction(
        t("confirmTitle"),
        t("confirmText", { name: member.name }),
        t("confirmButton"),
        { danger: true }
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const result = await adminApi.updateUserProfile(member.id, {
        phone: form.phone.trim(),
        region: form.region,
        skills: form.skills.trim(),
        availability: form.availability.trim(),
        status,
      });
      onSaved(result.user);
      toast(t("saved"));
    } catch (err) {
      showError(t("failed"), errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={save}>
      <Input label={tc("phone")} type="tel" maxLength={40} value={form.phone} onChange={set("phone")} />
      <Select label={tc("region")} placeholder={tc("notProvided")} options={regions} value={form.region} onChange={set("region")} />
      <Textarea
        full
        label={tc("skills")}
        rows={3}
        maxLength={2000}
        value={form.skills}
        onChange={set("skills")}
        placeholder={t("skillsPlaceholder")}
      />
      <Input
        full
        label={tc("availability")}
        maxLength={255}
        value={form.availability}
        onChange={set("availability")}
        placeholder={t("availabilityPlaceholder")}
      />
      <div className="field field--full">
        <Switch
          label={form.active ? t("active") : t("inactive")}
          checked={form.active}
          disabled={isSelf}
          onChange={(active) => setForm({ ...form, active })}
        />
        <span className="field__hint">{isSelf ? t("selfHint") : t("inactiveHint")}</span>
      </div>
      <div className="form-actions field--full">
        <Button type="submit" icon={Save} loading={saving}>{t("save")}</Button>
      </div>
    </form>
  );
}

function MemberModal({ member, user, matrix, regions, onClose, onSaved, onDeleted }) {
  const t = useTranslations("admin.members");
  const tc = useTranslations("admin.common");
  const f = useFormat();
  const labels = useLabels();
  const errorText = useErrorMessage();
  const { confirmAction, showError } = useAlerts();
  const tabs = [
    { value: "info", label: t("tabs.info") },
    can(user, P.MANAGE_USER_ROLES) && { value: "roles", label: t("tabs.roles") },
    can(user, P.MANAGE_HR) && { value: "hr", label: t("tabs.hr") },
  ].filter(Boolean);
  const [tab, setTab] = useState("info");
  const [deleting, setDeleting] = useState(false);
  const isSelf = Number(member.id) === Number(user.id);
  const canDelete = can(user, P.DELETE_USERS) && !isSelf;

  const remove = async () => {
    const ok = await confirmAction(
      t("delete.confirmTitle", { name: member.name }),
      t("delete.confirmText"),
      t("delete.confirmButton"),
      { danger: true }
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(member.id);
      toast(t("delete.done"));
      onDeleted(member.id);
    } catch (err) {
      showError(t("delete.refused"), errorText(err));
      setDeleting(false);
    }
  };

  return (
    <Modal
      open
      large
      title={member.name}
      onClose={onClose}
      footer={(
        <div className="row row--between adm-grow">
          {canDelete ? (
            <Button variant="ghost" icon={Trash2} className="adm-danger-text" loading={deleting} onClick={remove}>
              {t("delete.button")}
            </Button>
          ) : <span />}
          <Button variant="secondary" onClick={onClose}>{tc("close")}</Button>
        </div>
      )}
    >
      <div className="stack">
        <div className="adm-profile">
          <Avatar name={member.name} large />
          <div className="cell-main">
            <strong>{member.name}{isSelf && ` ${tc("you")}`}</strong>
            <span>{member.email}</span>
          </div>
          <StatusBadge status={labels.status("userStatus", member.status)} />
        </div>

        {tabs.length > 1 && <Tabs id="member-tabs" label={t("tabs.label")} tabs={tabs} value={tab} onChange={setTab} />}

        <div {...(tabs.length > 1 ? tabPanelProps("member-tabs", tab) : {})}>
        {tab === "info" && (
          <dl className="dl">
            <dt>{tc("email")}</dt>
            <dd><a href={`mailto:${member.email}`}>{member.email}</a></dd>
            <dt>{tc("phone")}</dt>
            <dd>{member.phone || "—"}</dd>
            <dt>{tc("region")}</dt>
            <dd>{member.region || "—"}</dd>
            <dt>{tc("roles")}</dt>
            <dd><RoleBadges roles={member.roles} /></dd>
            <dt>{tc("skills")}</dt>
            <dd>{member.skills || "—"}</dd>
            <dt>{tc("availability")}</dt>
            <dd>{member.availability || "—"}</dd>
            <dt>{t("info.lastLogin")}</dt>
            <dd>
              {member.last_login_at
                ? t("info.lastLoginValue", { relative: f.relative(member.last_login_at), date: f.dateTime(member.last_login_at) })
                : t("info.neverLoggedIn")}
            </dd>
            <dt>{t("info.createdAt")}</dt>
            <dd>{f.dateTime(member.created_at)}</dd>
            {member.must_change_password && (
              <>
                <dt>{t("info.password")}</dt>
                <dd><Badge tone="warning">{t("info.temporaryPassword")}</Badge></dd>
              </>
            )}
          </dl>
        )}
        {tab === "roles" && <RolesTab key={member.roles.join()} member={member} user={user} matrix={matrix} onSaved={onSaved} />}
        {tab === "hr" && <HrTab key={member.status} member={member} user={user} regions={regions} onSaved={onSaved} />}
        </div>
      </div>
    </Modal>
  );
}

// ---------- Liste (pagination et filtres serveur : GET /admin/users?page&pageSize&region&role&status&q) ----------

const NO_FILTERS = { region: "", role: "", status: "", q: "" };
const SEARCH_DELAY = 300;

function MembersDirectory() {
  const t = useTranslations("admin.members");
  const tc = useTranslations("admin.common");
  const f = useFormat();
  const labels = useLabels();
  const errorText = useErrorMessage();
  const { user } = useAuth();
  const { meta } = useMeta();
  const regions = regionOptions(meta);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(NO_FILTERS);
  // Saisie de recherche affichee tout de suite, envoyee a l'API apres une courte pause.
  const [search, setSearch] = useState("");
  const searchTimer = useRef(null);
  const { region } = filters;
  const { data, loading, error, reload, setData } = useAsync(
    async () => {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      return toPage(await adminApi.users({ page, pageSize: PAGE_SIZE, ...params }));
    },
    [page, filters]
  );
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  const { data: matrix } = useRoleMatrix();
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const members = useMemo(() => data?.rows || [], [data]);
  const total = data?.total || 0;
  const selected = members.find((member) => member.id === selectedId);

  const replace = (updated) => setData((current) => ({
    ...current,
    rows: current.rows.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
  }));

  const handleCreated = (result) => {
    setCreating(false);
    // Le nouveau compte apparait en tete de la premiere page (tri par date de creation).
    if (page === 1) reload();
    else setPage(1);
    if (result.tempPassword) {
      setCredentials({ name: result.user.name, email: result.user.email, password: result.tempPassword });
    } else {
      toast(t("createdToast"));
    }
  };

  const handleDeleted = () => {
    setSelectedId(null);
    if (members.length === 1 && page > 1) setPage(page - 1);
    else reload();
  };

  const applyFilters = (next) => {
    setFilters(next);
    setPage(1);
  };
  const setFilter = (key) => (event) => applyFilters({ ...filters, [key]: event.target.value });
  const changeSearch = (event) => {
    const value = event.target.value;
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => applyFilters({ ...filters, q: value.trim() }), SEARCH_DELAY);
  };
  const clearFilters = () => {
    clearTimeout(searchTimer.current);
    setSearch("");
    applyFilters(NO_FILTERS);
  };
  const hasFilters = Object.values(filters).some(Boolean);

  const columns = [
    {
      key: "name",
      header: t("columns.member"),
      render: (row) => (
        <div className="adm-member">
          <Avatar name={row.name} />
          <div className="cell-main">
            <strong>{row.name}{Number(row.id) === Number(user.id) && ` ${tc("you")}`}</strong>
            <span>{row.email}</span>
          </div>
        </div>
      ),
    },
    { key: "roles", header: t("columns.roles"), render: (row) => <RoleBadges roles={row.roles} /> },
    { key: "region", header: t("columns.region"), render: (row) => row.region || "—" },
    { key: "status", header: t("columns.status"), render: (row) => <StatusBadge status={labels.status("userStatus", row.status)} /> },
    {
      key: "last_login_at",
      header: t("columns.lastLogin"),
      render: (row) => (row.last_login_at
        ? <span title={f.dateTime(row.last_login_at)}>{f.relative(row.last_login_at)}</span>
        : <span className="muted">{t("never")}</span>),
    },
    { key: "created_at", header: t("columns.created"), render: (row) => f.shortDate(row.created_at) },
  ];

  const toolbar = (
    <>
      <input
        type="search"
        className="input"
        aria-label={t("searchPlaceholder")}
        placeholder={t("searchPlaceholder")}
        value={search}
        onChange={changeSearch}
        maxLength={100}
      />
      <select className="select" aria-label={t("filters.region")} value={region} onChange={setFilter("region")}>
        <option value="">{t("filters.allRegions")}</option>
        {regions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select className="select" aria-label={t("filters.role")} value={filters.role} onChange={setFilter("role")}>
        <option value="">{t("filters.allRoles")}</option>
        {ROLE_KEYS.map((role) => <option key={role} value={role}>{labels.role(role)}</option>)}
      </select>
      <select className="select" aria-label={t("filters.status")} value={filters.status} onChange={setFilter("status")}>
        <option value="">{t("filters.allStatuses")}</option>
        {STATUS_KEYS.userStatus.map((key) => <option key={key} value={key}>{labels.status("userStatus", key).label}</option>)}
      </select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          {t("filters.clear")}
        </Button>
      )}
    </>
  );

  let body;
  if (loading && !data) body = <PageSkeleton variant="table" columns={5} label={t("loading")} />;
  else if (error && !data) body = <ErrorState message={errorText(error)} onRetry={reload} />;
  else if (!total && !hasFilters) body = <EmptyState icon={Users} title={t("emptyTitle")} description={t("emptyText")} />;
  else {
    body = (
      <div aria-busy={loading}>
        {error && <ErrorState message={errorText(error)} onRetry={reload} />}
        <p className="muted adm-small adm-summary">
          {region ? t("summaryRegion", { total, region }) : t("summary", { total })}
        </p>
        <DataTable
          columns={columns}
          rows={members}
          pageSize={Math.max(PAGE_SIZE, members.length)}
          toolbar={toolbar}
          onRowClick={(row) => setSelectedId(row.id)}
          rowLabel={(row) => t("openRow", { name: row.name })}
          emptyTitle={t("noMatchTitle")}
          emptyDescription={t("noMatchText")}
        />
        <ServerPagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} disabled={loading} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={can(user, P.MANAGE_USER_ROLES) && (
          <Button icon={UserPlus} onClick={() => setCreating(true)}>{t("createAccount")}</Button>
        )}
      />
      {body}
      {creating && (
        <CreateUserModal user={user} matrix={matrix} regions={regions} onClose={() => setCreating(false)} onCreated={handleCreated} />
      )}
      {selected && (
        <MemberModal
          member={selected}
          user={user}
          matrix={matrix}
          regions={regions}
          onClose={() => setSelectedId(null)}
          onSaved={replace}
          onDeleted={handleDeleted}
        />
      )}
      <TempPasswordModal credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}

export default function Members() {
  return (
    <RequireAuth permission={P.VIEW_USERS}>
      <MembersDirectory />
    </RequireAuth>
  );
}
