"use client";

import "../../styles/admin-a.css";
import { useMemo, useState } from "react";
import { Save, Trash2, UserPlus, Users } from "lucide-react";
import {
  Alert, Avatar, Badge, Button, DataTable, EmptyState, ErrorState, Input, LoadingState, Modal, PageHeader, Select,
  StatusBadge, Switch, Tabs, Textarea,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { regionOptions, useMeta } from "../../hooks/useMeta";
import { adminApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { confirmAction, showError, toast } from "../../utils/alerts";
import { formatDateTime, formatRelative, formatShortDate } from "../../utils/format";
import { ROLE_LABELS, roleLabel, statusOf, USER_STATUS } from "../../utils/labels";
import { can, PERMISSIONS as P } from "../../utils/rbac";
import RolePicker from "./parts-a/RolePicker";
import TempPasswordModal from "./parts-a/TempPasswordModal";
import { canGrantAll, useRoleMatrix } from "./parts-a/roles";

const ROLE_FILTER = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_FILTER = Object.entries(USER_STATUS).map(([value, { label }]) => ({ value, label }));

function RoleBadges({ roles }) {
  return (
    <div className="chip-list">
      {(roles || []).map((role) => (
        <Badge key={role} tone={role === "membre" ? undefined : "brand"} plain>{roleLabel(role)}</Badge>
      ))}
    </div>
  );
}

// ---------- Creation de compte ----------

function CreateUserModal({ user, matrix, regions, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", region: "", roles: ["membre"] });
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    if (!form.roles.length) {
      showError("Choisissez au moins un rôle", "Un compte doit recevoir au moins un rôle (par exemple Membre).");
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
      showError("Création impossible", getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      large
      title="Créer un compte"
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="adm-create-user" icon={UserPlus} loading={saving}>Créer le compte</Button>
        </>
      )}
    >
      <form id="adm-create-user" className="form-grid" onSubmit={submit}>
        <Input label="Nom complet" required minLength={2} maxLength={150} value={form.name} onChange={set("name")} autoComplete="off" />
        <Input label="Email" type="email" required value={form.email} onChange={set("email")} autoComplete="off" />
        <Input label="Téléphone" type="tel" maxLength={40} value={form.phone} onChange={set("phone")} placeholder="+237 6 …" />
        <Select label="Région" placeholder="Non renseignée" options={regions} value={form.region} onChange={set("region")} />
        <RolePicker user={user} matrix={matrix} value={form.roles} onChange={(roles) => setForm({ ...form, roles })} />
        <div className="field--full">
          <Alert tone="info">
            Un mot de passe provisoire est généré et envoyé par email ; il devra être changé à la première connexion.
          </Alert>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Fiche membre ----------

function RolesTab({ member, user, matrix, onSaved }) {
  const [roles, setRoles] = useState(member.roles || []);
  const [saving, setSaving] = useState(false);
  const isSelf = Number(member.id) === Number(user.id);

  if (isSelf) {
    return (
      <Alert tone="info" title="Ce sont vos propres rôles">
        Par sécurité, personne ne peut modifier ses propres rôles. Demandez à un autre responsable habilité.
      </Alert>
    );
  }
  if (matrix && !canGrantAll(user, matrix, member.roles)) {
    return (
      <Alert tone="warning" title="Droits insuffisants">
        Ce compte dispose de droits que vous n&apos;avez pas : ses rôles ne peuvent être modifiés que par un niveau supérieur.
      </Alert>
    );
  }

  const unchanged = [...roles].sort().join() === [...(member.roles || [])].sort().join();

  const save = async () => {
    if (!roles.length) {
      showError("Choisissez au moins un rôle", "Pour retirer tout accès à l'administration, gardez uniquement le rôle Membre.");
      return;
    }
    setSaving(true);
    try {
      const result = await adminApi.updateUserRoles(member.id, roles);
      onSaved(result.user);
      toast("Rôles mis à jour");
    } catch (err) {
      showError("Modification refusée", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack">
      <RolePicker user={user} matrix={matrix} value={roles} onChange={setRoles} />
      <div className="row row--between">
        <span className="muted adm-small">Les nouveaux droits s&apos;appliquent dès la prochaine action du membre.</span>
        <Button icon={Save} loading={saving} disabled={unchanged} onClick={save}>Enregistrer les rôles</Button>
      </div>
    </div>
  );
}

function HrTab({ member, user, regions, onSaved }) {
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
        "Désactiver ce compte ?",
        `${member.name} sera immédiatement déconnecté(e) et ne pourra plus se connecter tant que le compte n'est pas réactivé.`,
        "Désactiver",
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
      toast("Fiche mise à jour");
    } catch (err) {
      showError("Enregistrement impossible", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={save}>
      <Input label="Téléphone" type="tel" maxLength={40} value={form.phone} onChange={set("phone")} />
      <Select label="Région" placeholder="Non renseignée" options={regions} value={form.region} onChange={set("region")} />
      <Textarea
        full
        label="Compétences"
        rows={3}
        maxLength={2000}
        value={form.skills}
        onChange={set("skills")}
        placeholder="Ex. comptabilité, animation d'ateliers, agronomie…"
      />
      <Input full label="Disponibilités" maxLength={255} value={form.availability} onChange={set("availability")} placeholder="Ex. les samedis, 2 jours par mois…" />
      <div className="field field--full">
        <Switch
          label={form.active ? "Compte actif" : "Compte désactivé"}
          checked={form.active}
          disabled={isSelf}
          onChange={(active) => setForm({ ...form, active })}
        />
        <span className="field__hint">
          {isSelf ? "Vous ne pouvez pas désactiver votre propre compte." : "Un compte désactivé ne peut plus se connecter."}
        </span>
      </div>
      <div className="form-actions field--full">
        <Button type="submit" icon={Save} loading={saving}>Enregistrer la fiche</Button>
      </div>
    </form>
  );
}

function MemberModal({ member, user, matrix, regions, onClose, onSaved, onDeleted }) {
  const tabs = [
    { value: "info", label: "Coordonnées" },
    can(user, P.MANAGE_USER_ROLES) && { value: "roles", label: "Rôles" },
    can(user, P.MANAGE_HR) && { value: "hr", label: "Fiche RH" },
  ].filter(Boolean);
  const [tab, setTab] = useState("info");
  const [deleting, setDeleting] = useState(false);
  const isSelf = Number(member.id) === Number(user.id);
  const canDelete = can(user, P.DELETE_USERS) && !isSelf;

  const remove = async () => {
    const ok = await confirmAction(
      `Supprimer le compte de ${member.name} ?`,
      "Le compte et son accès seront définitivement supprimés. Cette action est irréversible ; pour une suspension temporaire, désactivez plutôt le compte depuis la fiche RH.",
      "Supprimer définitivement",
      { danger: true }
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(member.id);
      toast("Compte supprimé");
      onDeleted(member.id);
    } catch (err) {
      showError("Suppression refusée", getErrorMessage(err));
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
              Supprimer le compte
            </Button>
          ) : <span />}
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
        </div>
      )}
    >
      <div className="stack">
        <div className="adm-profile">
          <Avatar name={member.name} large />
          <div className="cell-main">
            <strong>{member.name}{isSelf && " (vous)"}</strong>
            <span>{member.email}</span>
          </div>
          <StatusBadge status={statusOf(USER_STATUS, member.status)} />
        </div>

        {tabs.length > 1 && <Tabs label="Sections de la fiche" tabs={tabs} value={tab} onChange={setTab} />}

        {tab === "info" && (
          <dl className="dl">
            <dt>Email</dt>
            <dd><a href={`mailto:${member.email}`}>{member.email}</a></dd>
            <dt>Téléphone</dt>
            <dd>{member.phone || "—"}</dd>
            <dt>Région</dt>
            <dd>{member.region || "—"}</dd>
            <dt>Rôles</dt>
            <dd><RoleBadges roles={member.roles} /></dd>
            <dt>Compétences</dt>
            <dd>{member.skills || "—"}</dd>
            <dt>Disponibilités</dt>
            <dd>{member.availability || "—"}</dd>
            <dt>Dernière connexion</dt>
            <dd>{member.last_login_at ? `${formatRelative(member.last_login_at)} (${formatDateTime(member.last_login_at)})` : "Jamais connecté"}</dd>
            <dt>Compte créé le</dt>
            <dd>{formatDateTime(member.created_at)}</dd>
            {member.must_change_password && (
              <>
                <dt>Mot de passe</dt>
                <dd><Badge tone="warning">Provisoire, à changer</Badge></dd>
              </>
            )}
          </dl>
        )}
        {tab === "roles" && <RolesTab key={member.roles.join()} member={member} user={user} matrix={matrix} onSaved={onSaved} />}
        {tab === "hr" && <HrTab key={member.status} member={member} user={user} regions={regions} onSaved={onSaved} />}
      </div>
    </Modal>
  );
}

// ---------- Liste ----------

function MembersDirectory() {
  const { user } = useAuth();
  const { meta } = useMeta();
  const regions = regionOptions(meta);
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.users(), []);
  const { data: matrix } = useRoleMatrix();
  const [filters, setFilters] = useState({ role: "", region: "", status: "" });
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const members = useMemo(() => data || [], [data]);
  const rows = useMemo(() => members.filter((member) => (
    (!filters.role || member.roles?.includes(filters.role))
    && (!filters.region || member.region === filters.region)
    && (!filters.status || member.status === filters.status)
  )), [members, filters]);
  const selected = members.find((member) => member.id === selectedId);
  const activeCount = members.filter((member) => member.status === "active").length;

  const replace = (updated) => setData((list) => list.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));

  const handleCreated = (result) => {
    setCreating(false);
    setData((list) => [result.user, ...list]);
    if (result.tempPassword) {
      setCredentials({ name: result.user.name, email: result.user.email, password: result.tempPassword });
    } else {
      toast("Compte créé : les identifiants ont été envoyés par email");
    }
  };

  const setFilter = (key) => (event) => setFilters({ ...filters, [key]: event.target.value });
  const hasFilters = Object.values(filters).some(Boolean);

  const columns = [
    {
      key: "name",
      header: "Membre",
      sortable: true,
      render: (row) => (
        <div className="adm-member">
          <Avatar name={row.name} />
          <div className="cell-main">
            <strong>{row.name}{Number(row.id) === Number(user.id) && " (vous)"}</strong>
            <span>{row.email}</span>
          </div>
        </div>
      ),
    },
    { key: "roles", header: "Rôles", render: (row) => <RoleBadges roles={row.roles} /> },
    { key: "region", header: "Région", sortable: true, render: (row) => row.region || "—" },
    { key: "status", header: "Statut", sortable: true, render: (row) => <StatusBadge status={statusOf(USER_STATUS, row.status)} /> },
    {
      key: "last_login_at",
      header: "Dernière connexion",
      sortable: true,
      sortValue: (row) => (row.last_login_at ? new Date(row.last_login_at).getTime() : null),
      render: (row) => (row.last_login_at
        ? <span title={formatDateTime(row.last_login_at)}>{formatRelative(row.last_login_at)}</span>
        : <span className="muted">Jamais</span>),
    },
    {
      key: "created_at",
      header: "Création",
      sortable: true,
      sortValue: (row) => new Date(row.created_at).getTime(),
      render: (row) => formatShortDate(row.created_at),
    },
  ];

  const toolbar = (
    <>
      <select className="select" aria-label="Filtrer par rôle" value={filters.role} onChange={setFilter("role")}>
        <option value="">Tous les rôles</option>
        {ROLE_FILTER.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select className="select" aria-label="Filtrer par région" value={filters.region} onChange={setFilter("region")}>
        <option value="">Toutes les régions</option>
        {regions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select className="select" aria-label="Filtrer par statut" value={filters.status} onChange={setFilter("status")}>
        <option value="">Tous les statuts</option>
        {STATUS_FILTER.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => setFilters({ role: "", region: "", status: "" })}>Effacer les filtres</Button>
      )}
    </>
  );

  let body;
  if (loading) body = <LoadingState label="Chargement des membres…" />;
  else if (error) body = <ErrorState message={getErrorMessage(error)} onRetry={reload} />;
  else if (!members.length) body = <EmptyState icon={Users} title="Aucun membre" description="Les comptes créés ou inscrits apparaîtront ici." />;
  else {
    body = (
      <>
        <p className="muted adm-small adm-summary">
          {members.length} compte{members.length > 1 ? "s" : ""} · {activeCount} actif{activeCount > 1 ? "s" : ""}
          {hasFilters && ` · ${rows.length} affiché${rows.length > 1 ? "s" : ""}`}
        </p>
        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={["name", "email"]}
          searchPlaceholder="Rechercher par nom ou email…"
          toolbar={toolbar}
          onRowClick={(row) => setSelectedId(row.id)}
          initialSort={{ key: "name", dir: "asc" }}
          emptyTitle="Aucun membre ne correspond"
          emptyDescription="Modifiez la recherche ou les filtres."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Équipe"
        title="Membres"
        description="Tous les comptes de la plateforme : coordonnées, rôles et fiches RH."
        actions={can(user, P.MANAGE_USER_ROLES) && (
          <Button icon={UserPlus} onClick={() => setCreating(true)}>Créer un compte</Button>
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
          onDeleted={(id) => {
            setData((list) => list.filter((item) => item.id !== id));
            setSelectedId(null);
          }}
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
