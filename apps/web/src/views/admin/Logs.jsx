"use client";

import "../../styles/admin-a.css";
import { useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, Select } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { adminApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatDateTime, formatNumber, formatRelative } from "../../utils/format";
import { PERMISSIONS as P } from "../../utils/rbac";

const PAGE_SIZE = 50;

const CATEGORIES = [
  { value: "auth", label: "Connexions et comptes" },
  { value: "admin", label: "Administration des comptes" },
  { value: "payment", label: "Paiements" },
  { value: "application", label: "Candidatures" },
  { value: "message", label: "Messages" },
  { value: "content", label: "Contenus" },
  { value: "event", label: "Événements" },
  { value: "hr", label: "Ressources humaines" },
  { value: "finance", label: "Finance" },
];

const ACTION_LABELS = {
  "auth.login": "Connexion",
  "auth.login_failed": "Échec de connexion",
  "auth.register": "Inscription",
  "auth.password_changed": "Mot de passe modifié",
  "auth.password_reset_requested": "Demande de réinitialisation du mot de passe",
  "auth.password_reset": "Mot de passe réinitialisé",
  "admin.create_user": "Compte créé",
  "admin.update_user_roles": "Rôles modifiés",
  "admin.delete_user": "Compte supprimé",
  "hr.update_profile": "Fiche membre mise à jour",
  "payment.initiated": "Don initié",
  "payment.succeeded": "Don confirmé",
  "payment.failed": "Paiement échoué",
  "payment.canceled": "Paiement annulé",
  "payment.refunded": "Don remboursé",
  "payment.pending": "Paiement en attente",
  "payment.amount_mismatch": "Montant incohérent signalé",
  "payment.subscription_canceled": "Don mensuel arrêté",
  "payment.subscription_ended": "Don mensuel terminé",
  "application.submitted": "Candidature reçue",
  "application.reviewing": "Candidature mise en étude",
  "application.accepted": "Candidature acceptée",
  "application.rejected": "Candidature refusée",
  "message.created": "Message reçu",
  "message.updated": "Message mis à jour",
  "message.deleted": "Message supprimé",
  "event.create": "Événement créé",
  "event.update": "Événement modifié",
  "event.delete": "Événement supprimé",
  "event.register": "Inscription à un événement",
  "event.unregister": "Désinscription d'un événement",
  "finance.reconcile": "Rapprochement des paiements",
};

const CONTENT_VERBS = { create: "créé(e)", update: "modifié(e)", delete: "supprimé(e)" };
const CONTENT_TYPES = { projects: "Projet", news: "Actualité", testimonials: "Témoignage" };

function actionLabel(action) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const [domain, verb, type] = String(action).split(".");
  if (domain === "content" && CONTENT_VERBS[verb] && CONTENT_TYPES[type]) return `${CONTENT_TYPES[type]} ${CONTENT_VERBS[verb]}`;
  return action;
}

const TONES = { auth: "info", admin: "accent", hr: "accent", payment: "success", finance: "success" };
const actionTone = (action) => {
  if (/failed|mismatch/.test(action)) return "danger";
  if (/delete/.test(action)) return "warning";
  return TONES[String(action).split(".")[0]] || "brand";
};

function MetaDetails({ meta }) {
  if (!meta || (typeof meta === "object" && !Object.keys(meta).length)) return <span className="muted">—</span>;
  const text = typeof meta === "string" ? meta : JSON.stringify(meta, null, 2);
  return (
    <details className="adm-meta">
      <summary>Détails</summary>
      <pre>{text}</pre>
    </details>
  );
}

function Journal() {
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);
  const { data, loading, error, reload } = useAsync(
    () => adminApi.logs({ limit: PAGE_SIZE, offset, action: action || undefined }),
    [offset, action]
  );

  const total = data?.total || 0;
  const items = data?.items || [];

  return (
    <>
      <PageHeader
        eyebrow="Système"
        title="Journal d'activité"
        description="Toutes les actions sensibles, horodatées : connexions, dons, décisions, modifications de comptes et de contenus."
        actions={<Button variant="secondary" icon={RefreshCw} loading={loading} onClick={reload}>Actualiser</Button>}
      />

      <div className="table-toolbar">
        <Select
          label="Type d'action"
          placeholder="Toutes les actions"
          options={CATEGORIES}
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setOffset(0);
          }}
        />
        {!loading && !error && (
          <span className="muted adm-small adm-toolbar-note">{formatNumber(total)} entrée{total > 1 ? "s" : ""}</span>
        )}
      </div>

      {loading && !data ? (
        <LoadingState label="Chargement du journal…" />
      ) : error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : !items.length ? (
        <EmptyState
          icon={ScrollText}
          title="Aucune entrée"
          description={action ? "Aucune action de ce type n'a été enregistrée." : "Le journal est vide pour le moment."}
        />
      ) : (
        <>
          <div className="table-wrap" aria-busy={loading}>
            <table className="table adm-logs">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Action</th>
                  <th scope="col">Auteur</th>
                  <th scope="col">Détails</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="adm-nowrap">
                      <div className="cell-main">
                        <strong>{formatDateTime(item.created_at)}</strong>
                        <span>{formatRelative(item.created_at)}</span>
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
                          <strong>{item.user_name || `Compte n° ${item.user_id}`}</strong>
                          <span>{item.user_email || "Compte supprimé"}</span>
                        </div>
                      ) : (
                        <span className="muted">Visiteur ou système</span>
                      )}
                    </td>
                    <td><MetaDetails meta={item.meta} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              {formatNumber(offset + 1)}–{formatNumber(Math.min(total, offset + items.length))} sur {formatNumber(total)}
            </span>
            <div className="row">
              <Button size="sm" variant="secondary" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                Plus récentes
              </Button>
              <Button size="sm" variant="secondary" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset(offset + PAGE_SIZE)}>
                Plus anciennes
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
