"use client";

import "../../styles/admin-a.css";
import { Check, Minus } from "lucide-react";
import { Badge, ErrorState, LoadingState, PageHeader } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { getErrorMessage } from "../../services/api";
import { PERMISSIONS as P } from "../../utils/rbac";
import { canGrantRole, useRoleMatrix } from "./parts-a/roles";

const RULES = [
  {
    title: "Attribuer seulement ce que l'on possède",
    text: "On ne peut donner (ou retirer) un rôle que si l'on dispose déjà de tous ses droits. Idem pour agir sur un compte : ses droits ne doivent pas dépasser les vôtres.",
  },
  {
    title: "Administrateur système : un rôle à part",
    text: "Il donne tous les droits, ne se combine avec aucun autre rôle et ne peut être attribué que par un administrateur.",
  },
  {
    title: "Pas d'auto-modification",
    text: "Personne ne peut modifier ses propres rôles, ni désactiver ou supprimer son propre compte.",
  },
  {
    title: "Le dernier administrateur est protégé",
    text: "Le dernier administrateur actif ne peut être ni rétrogradé, ni désactivé, ni supprimé.",
  },
];

function Matrix() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useRoleMatrix();

  const header = (
    <PageHeader
      eyebrow="Équipe"
      title="Rôles et droits"
      description="Ce que chaque rôle permet de faire dans l'administration. Un membre peut cumuler plusieurs rôles : ses droits s'additionnent."
    />
  );

  if (loading) return <>{header}<LoadingState label="Chargement de la matrice des droits…" /></>;
  if (error) return <>{header}<ErrorState message={getErrorMessage(error)} onRetry={reload} /></>;

  const { roles, permissionLabels } = data;
  const permissions = Object.keys(permissionLabels);
  const mine = new Set(user?.roles || []);

  return (
    <>
      {header}

      <section className="panel adm-mine" aria-labelledby="adm-mine-title">
        <h2 className="panel__title" id="adm-mine-title">Vos rôles</h2>
        <div className="chip-list">
          {(user?.roles || []).map((role) => (
            <Badge key={role} tone="accent">{data.roleLabels[role] || role}</Badge>
          ))}
        </div>
        <p className="muted adm-small">
          Vous disposez de {user?.permissions?.length || 0} droit{(user?.permissions?.length || 0) > 1 ? "s" : ""} sur {permissions.length}.
          Vos colonnes sont surlignées dans le tableau.
        </p>
      </section>

      <section className="panel" aria-labelledby="adm-matrix-title">
        <div className="panel__head">
          <div>
            <h2 className="panel__title" id="adm-matrix-title">Matrice des droits</h2>
            <p className="panel__desc">✓ : droit accordé par le rôle. Faites défiler horizontalement sur petit écran.</p>
          </div>
        </div>

        <div className="table-wrap adm-matrix-wrap">
          <table className="table adm-matrix">
            <caption className="visually-hidden">Droits accordés par chaque rôle</caption>
            <thead>
              <tr>
                <th scope="col" className="adm-matrix__corner">Droit</th>
                {roles.map((entry) => (
                  <th key={entry.role} scope="col" className={mine.has(entry.role) ? "is-mine" : undefined}>
                    <span className="adm-matrix__role">{entry.label}</span>
                    {mine.has(entry.role) && <span className="adm-matrix__tag">Vous</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission}>
                  <th scope="row">{permissionLabels[permission]}</th>
                  {roles.map((entry) => {
                    const granted = entry.permissions.includes(permission);
                    return (
                      <td key={entry.role} className={mine.has(entry.role) ? "is-mine" : undefined}>
                        {granted ? <Check size={18} className="adm-yes" aria-hidden="true" /> : <Minus size={16} className="adm-no" aria-hidden="true" />}
                        <span className="visually-hidden">{granted ? "Oui" : "Non"}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="adm-matrix__total">
                <th scope="row">Nombre de droits</th>
                {roles.map((entry) => (
                  <td key={entry.role} className={mine.has(entry.role) ? "is-mine" : undefined}>{entry.permissions.length}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="admin-panels">
        <section className="panel" aria-labelledby="adm-rules-title">
          <h2 className="panel__title" id="adm-rules-title">Règles d&apos;attribution</h2>
          <ol className="adm-rules">
            {RULES.map((rule) => (
              <li key={rule.title}>
                <strong>{rule.title}</strong>
                <span>{rule.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel" aria-labelledby="adm-grant-title">
          <h2 className="panel__title" id="adm-grant-title">Rôles que vous pouvez attribuer</h2>
          <p className="panel__desc">D&apos;après vos droits actuels (création de compte, acceptation de candidature, modification des rôles).</p>
          {user?.permissions?.includes(P.MANAGE_USER_ROLES) ? (
            <ul className="adm-grant">
              {roles.map((entry) => {
                const ok = canGrantRole(user, entry);
                return (
                  <li key={entry.role}>
                    <span>{entry.label}</span>
                    {ok ? <Badge tone="success">Attribuable</Badge> : <Badge>Hors de vos droits</Badge>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="adm-note">Votre rôle ne permet pas de créer des comptes ni de modifier les rôles.</p>
          )}
        </section>
      </div>
    </>
  );
}

export default function Roles() {
  return (
    <RequireAuth permission={P.ACCESS_ADMIN_DASHBOARD}>
      <Matrix />
    </RequireAuth>
  );
}
