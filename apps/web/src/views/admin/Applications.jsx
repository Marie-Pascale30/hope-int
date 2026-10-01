"use client";

import "../../styles/admin-a.css";
import { useMemo, useState } from "react";
import { Check, ClipboardCheck, Search, X } from "lucide-react";
import {
  Alert, Badge, Button, DataTable, EmptyState, ErrorState, LoadingState, Modal, PageHeader, StatusBadge, Tabs, Textarea,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { adminApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { confirmAction, showError, toast } from "../../utils/alerts";
import { formatDateTime, formatRelative, truncate } from "../../utils/format";
import { APPLICATION_STATUS, roleLabel, statusOf } from "../../utils/labels";
import { can, PERMISSIONS as P } from "../../utils/rbac";
import RolePicker from "./parts-a/RolePicker";
import TempPasswordModal from "./parts-a/TempPasswordModal";
import { canGrantRole, useRoleMatrix } from "./parts-a/roles";

const TABS = [
  { value: "nouvelle", label: "Nouvelles" },
  { value: "en_etude", label: "En étude" },
  { value: "acceptee", label: "Acceptées" },
  { value: "refusee", label: "Refusées" },
  { value: "all", label: "Toutes" },
];

const isOpen = (application) => ["nouvelle", "en_etude"].includes(application.status);

function RoleBadges({ roles }) {
  return (
    <div className="chip-list">
      {(roles || []).map((role) => <Badge key={role} tone="brand" plain>{roleLabel(role)}</Badge>)}
    </div>
  );
}

function ApplicationDetail({ application, user, matrix, onClose, onUpdated, onAccepted }) {
  const canAccept = can(user, P.MANAGE_USER_ROLES);
  const grantable = (role) => canGrantRole(user, matrix?.roles.find((entry) => entry.role === role));
  const desired = application.desired_roles?.length ? application.desired_roles : ["membre"];
  const [note, setNote] = useState(application.review_note || "");
  const [roles, setRoles] = useState(() => desired.filter(grantable));
  const [busy, setBusy] = useState(null);
  const open = isOpen(application);
  const excluded = desired.filter((role) => !grantable(role));

  const run = async (action, handler) => {
    setBusy(action);
    try {
      await handler();
    } catch (err) {
      showError("Action impossible", getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const review = () => run("review", async () => {
    const updated = await adminApi.reviewApplication(application.id, note.trim() || null);
    onUpdated(updated);
    toast("Candidature mise en étude");
  });

  const reject = async () => {
    const ok = await confirmAction(
      "Refuser cette candidature ?",
      note.trim()
        ? `${application.name} sera prévenu(e) par email, avec votre note.`
        : `${application.name} sera prévenu(e) par email. Vous pouvez ajouter une note explicative avant de refuser.`,
      "Refuser",
      { danger: true }
    );
    if (!ok) return;
    run("reject", async () => {
      const updated = await adminApi.rejectApplication(application.id, note.trim() || null);
      onUpdated(updated);
      toast("Candidature refusée");
    });
  };

  const accept = () => {
    if (!roles.length) {
      showError("Choisissez au moins un rôle", "Le compte doit recevoir au moins un rôle (par exemple Membre).");
      return;
    }
    run("accept", async () => {
      const result = await adminApi.acceptApplication(application.id, { roles, reviewNote: note.trim() || undefined });
      onAccepted(result);
    });
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
              Mettre en étude
            </Button>
          )}
          <Button variant="danger" icon={X} loading={busy === "reject"} disabled={Boolean(busy)} onClick={reject}>Refuser</Button>
          {canAccept && (
            <Button icon={Check} loading={busy === "accept"} disabled={Boolean(busy)} onClick={accept}>
              Accepter et créer le compte
            </Button>
          )}
        </>
      ) : (
        <Button variant="secondary" onClick={onClose}>Fermer</Button>
      )}
    >
      <div className="stack">
        <div className="row">
          <StatusBadge status={statusOf(APPLICATION_STATUS, application.status)} />
          <span className="muted adm-small">Reçue {formatRelative(application.created_at)} · {formatDateTime(application.created_at)}</span>
        </div>

        <dl className="dl">
          <dt>Email</dt>
          <dd><a href={`mailto:${application.email}`}>{application.email}</a></dd>
          <dt>Téléphone</dt>
          <dd>{application.phone || "—"}</dd>
          <dt>Région</dt>
          <dd>{application.region || "—"}</dd>
          <dt>Rôles souhaités</dt>
          <dd><RoleBadges roles={application.desired_roles} /></dd>
          {application.reviewer_name && (
            <>
              <dt>Examinée par</dt>
              <dd>{application.reviewer_name}</dd>
            </>
          )}
        </dl>

        <div>
          <h3 className="adm-subtitle">Motivation</h3>
          <blockquote className="adm-quote">{application.motivation}</blockquote>
        </div>

        {open ? (
          <>
            <Textarea
              label="Note d'examen"
              hint="En cas de refus, cette note est transmise au candidat dans l'email de réponse."
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
                  onChange={setRoles}
                  label="Rôles du compte à créer"
                  hint="Pré-rempli avec les rôles souhaités. Le rôle Administrateur système ne se combine avec aucun autre."
                />
                {excluded.length > 0 && (
                  <Alert tone="info">
                    Rôle souhaité non attribuable avec vos droits : {excluded.map(roleLabel).join(", ")}. Une personne disposant de ces droits pourra l&apos;ajouter ensuite.
                  </Alert>
                )}
              </div>
            ) : (
              <Alert tone="info">
                L&apos;acceptation crée un compte : elle est réservée aux personnes qui gèrent les rôles (RH, direction, IT).
              </Alert>
            )}
          </>
        ) : (
          application.review_note && (
            <div>
              <h3 className="adm-subtitle">Note d&apos;examen</h3>
              <p className="adm-note">{application.review_note}</p>
            </div>
          )
        )}
      </div>
    </Modal>
  );
}

function ApplicationsInbox() {
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.applications(), []);
  const { data: matrix } = useRoleMatrix();
  const [tab, setTab] = useState("nouvelle");
  const [selectedId, setSelectedId] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const applications = useMemo(() => data || [], [data]);
  const counts = useMemo(
    () => applications.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {}),
    [applications]
  );
  const rows = tab === "all" ? applications : applications.filter((item) => item.status === tab);
  const selected = applications.find((item) => item.id === selectedId);

  // findById ne renvoie pas le nom de l'examinateur : c'est l'utilisateur courant qui vient d'agir.
  const replace = (updated) => setData((list) => list.map((item) => (
    item.id === updated.id ? { ...item, ...updated, reviewer_name: updated.reviewer_name || user.name } : item
  )));

  const handleAccepted = (result) => {
    replace(result.application);
    setSelectedId(null);
    if (result.tempPassword) {
      setCredentials({ name: result.user.name, email: result.user.email, password: result.tempPassword });
    } else {
      toast("Compte créé : les identifiants ont été envoyés par email");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Candidat",
      sortable: true,
      render: (row) => (
        <div className="cell-main">
          <strong>{row.name}</strong>
          <span>{row.email}</span>
        </div>
      ),
    },
    { key: "region", header: "Région", sortable: true, render: (row) => row.region || "—" },
    { key: "desired_roles", header: "Rôles souhaités", render: (row) => <RoleBadges roles={row.desired_roles} /> },
    {
      key: "motivation",
      header: "Motivation",
      render: (row) => <span className="adm-clip">{truncate(row.motivation, 90)}</span>,
    },
    {
      key: "created_at",
      header: "Reçue",
      sortable: true,
      sortValue: (row) => new Date(row.created_at).getTime(),
      render: (row) => <span title={formatDateTime(row.created_at)}>{formatRelative(row.created_at)}</span>,
    },
    { key: "status", header: "Statut", render: (row) => <StatusBadge status={statusOf(APPLICATION_STATUS, row.status)} /> },
  ];

  let body;
  if (loading) body = <LoadingState label="Chargement des candidatures…" />;
  else if (error) body = <ErrorState message={getErrorMessage(error)} onRetry={reload} />;
  else if (!applications.length) {
    body = (
      <EmptyState
        icon={ClipboardCheck}
        title="Aucune candidature pour le moment"
        description="Les candidatures envoyées depuis la page « Nous rejoindre » du site apparaîtront ici."
      />
    );
  } else {
    body = (
      <>
        <Tabs
          label="Statut des candidatures"
          value={tab}
          onChange={setTab}
          tabs={TABS.map((item) => ({ ...item, count: item.value === "all" ? applications.length : counts[item.value] || 0 }))}
        />
        <DataTable
          columns={columns}
          rows={rows}
          searchKeys={["name", "email", "region"]}
          searchPlaceholder="Rechercher un candidat…"
          onRowClick={(row) => setSelectedId(row.id)}
          initialSort={{ key: "created_at", dir: "desc" }}
          emptyTitle="Aucune candidature dans cet onglet"
          emptyDescription={tab === "nouvelle" ? "Toutes les nouvelles candidatures ont été prises en charge." : undefined}
        />
        <p className="muted adm-small adm-hint">Cliquez sur une ligne pour lire la candidature et y répondre.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Relations"
        title="Candidatures"
        description="Étudiez les demandes d'engagement, répondez aux candidats et créez leur compte en un clic."
      />
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
