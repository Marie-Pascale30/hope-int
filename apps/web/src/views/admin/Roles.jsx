"use client";

import { Check, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, ErrorState, PageSkeleton, PageHeader } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useLabels } from "../../utils/labels";
import { PERMISSIONS as P } from "../../utils/rbac";
import { useErrorMessage } from "../../i18n/errors";
import { canGrantRole, useRoleMatrix } from "./parts-a/roles";

// Cles des messages "admin.roles.rules" (titre + texte).
const RULES = ["own", "admin", "self", "lastAdmin"];

function Matrix() {
  const t = useTranslations("admin.roles");
  const tc = useTranslations("admin.common");
  const labels = useLabels();
  const errorText = useErrorMessage();
  const { user } = useAuth();
  const { data, loading, error, reload } = useRoleMatrix();

  const header = <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />;

  if (loading) return <>{header}<PageSkeleton variant="table" columns={6} rows={8} label={t("loading")} /></>;
  if (error) return <>{header}<ErrorState message={errorText(error)} onRetry={reload} /></>;

  const { roles, permissionLabels } = data;
  const permissions = Object.keys(permissionLabels);
  // Libelles des droits traduits par cle ; repli sur le libelle renvoye par l'API.
  const permissionLabel = (key) => (t.has(`permissions.${key}`) ? t(`permissions.${key}`) : permissionLabels[key]);
  const mine = new Set(user?.roles || []);

  return (
    <>
      {header}

      <section className="panel adm-mine" aria-labelledby="adm-mine-title">
        <h2 className="panel__title" id="adm-mine-title">{t("mine")}</h2>
        <div className="chip-list">
          {(user?.roles || []).map((role) => (
            <Badge key={role} tone="accent">{labels.role(role)}</Badge>
          ))}
        </div>
        <p className="muted adm-small">
          {t("mineSummary", { count: user?.permissions?.length || 0, total: permissions.length })}
        </p>
      </section>

      <section className="panel" aria-labelledby="adm-matrix-title">
        <div className="panel__head">
          <div>
            <h2 className="panel__title" id="adm-matrix-title">{t("matrixTitle")}</h2>
            <p className="panel__desc">{t("matrixDesc")}</p>
          </div>
        </div>

        <div className="table-wrap adm-matrix-wrap">
          <table className="table adm-matrix">
            <caption className="visually-hidden">{t("matrixCaption")}</caption>
            <thead>
              <tr>
                <th scope="col" className="adm-matrix__corner">{t("permissionColumn")}</th>
                {roles.map((entry) => (
                  <th key={entry.role} scope="col" className={mine.has(entry.role) ? "is-mine" : undefined}>
                    <span className="adm-matrix__role">{labels.role(entry.role)}</span>
                    {mine.has(entry.role) && <span className="adm-matrix__tag">{tc("youTag")}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((permission) => (
                <tr key={permission}>
                  <th scope="row">{permissionLabel(permission)}</th>
                  {roles.map((entry) => {
                    const granted = entry.permissions.includes(permission);
                    return (
                      <td key={entry.role} className={mine.has(entry.role) ? "is-mine" : undefined}>
                        {granted ? <Check size={18} className="adm-yes" aria-hidden="true" /> : <Minus size={16} className="adm-no" aria-hidden="true" />}
                        <span className="visually-hidden">{granted ? t("yes") : t("no")}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="adm-matrix__total">
                <th scope="row">{t("total")}</th>
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
          <h2 className="panel__title" id="adm-rules-title">{t("rulesTitle")}</h2>
          <ol className="adm-rules">
            {RULES.map((rule) => (
              <li key={rule}>
                <strong>{t(`rules.${rule}Title`)}</strong>
                <span>{t(`rules.${rule}Text`)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel" aria-labelledby="adm-grant-title">
          <h2 className="panel__title" id="adm-grant-title">{t("grantTitle")}</h2>
          <p className="panel__desc">{t("grantDesc")}</p>
          {user?.permissions?.includes(P.MANAGE_USER_ROLES) ? (
            <ul className="adm-grant">
              {roles.map((entry) => {
                const ok = canGrantRole(user, entry);
                return (
                  <li key={entry.role}>
                    <span>{labels.role(entry.role)}</span>
                    {ok ? <Badge tone="success">{t("grantable")}</Badge> : <Badge>{t("notGrantable")}</Badge>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="adm-note">{t("cannotGrant")}</p>
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
