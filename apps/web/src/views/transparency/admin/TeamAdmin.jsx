"use client";

// Portraits publics de l'equipe (RH) : liste des comptes actifs, consentement et fiche publique.
// Seuls les portraits consentis apparaissent sur la page /equipe.
import "@/src/styles/transparency.css";
import { useMemo, useState } from "react";
import { Pencil, Search, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, Button, EmptyState, ErrorState, Modal, PageHeader, PageSkeleton } from "@/src/components/ui";
import RequireAuth from "@/src/components/RequireAuth";
import { useAsync } from "@/src/hooks/useAsync";
import { useErrorMessage } from "@/src/i18n/errors";
import { transparencyApi } from "@/src/services/transparency";
import { PERMISSIONS as P } from "@/src/utils/rbac";
import AdminTabs from "./AdminTabs";
import TeamProfileForm from "./TeamProfileForm";

function TeamView() {
  const t = useTranslations("transparency.admin.team");
  const getErrorMessage = useErrorMessage();
  const { data, loading, error, reload } = useAsync(() => transparencyApi.teamProfiles(), []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);

  const profiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = data?.profiles || [];
    return needle ? list.filter((p) => `${p.name} ${p.email} ${p.region || ""}`.toLowerCase().includes(needle)) : list;
  }, [data, query]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <AdminTabs />
      <section className="panel" aria-labelledby="tp-team-title">
        <div className="panel__head">
          <div>
            <h2 id="tp-team-title" className="panel__title">{t("listTitle")}</h2>
            <p className="panel__desc">{t("listText", { count: (data?.profiles || []).filter((p) => p.publicProfile).length })}</p>
          </div>
          <div className="adm-inline-select">
            <label htmlFor="tp-team-search"><Search size={14} aria-hidden="true" /> {t("search")}</label>
            <input id="tp-team-search" className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>
        {error ? (
          <ErrorState message={getErrorMessage(error)} onRetry={reload} />
        ) : loading || !data ? (
          <PageSkeleton variant="table" label={t("loading")} />
        ) : profiles.length === 0 ? (
          <EmptyState icon={UserRound} title={t("emptyTitle")} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">{t("listTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("name")}</th>
                  <th scope="col">{t("region")}</th>
                  <th scope="col">{t("publicTitle")}</th>
                  <th scope="col">{t("status")}</th>
                  <th scope="col"><span className="visually-hidden">{t("edit")}</span></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <th scope="row">{profile.name}<span className="muted tp-email">{profile.email}</span></th>
                    <td>{profile.region || "—"}</td>
                    <td>{profile.title || "—"}</td>
                    <td>{profile.publicProfile ? <Badge tone="success">{t("visible")}</Badge> : <Badge>{t("hidden")}</Badge>}</td>
                    <td>
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditing(profile)} aria-label={t("editNamed", { name: profile.name })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <Modal open title={t("modalTitle", { name: editing.name })} onClose={() => setEditing(null)}>
          <TeamProfileForm
            profile={editing}
            save={(payload) => transparencyApi.updateTeamProfile(editing.id, payload)}
            onSaved={() => { setEditing(null); reload(); }}
          />
        </Modal>
      )}
    </>
  );
}

export default function TeamAdmin() {
  return (
    <RequireAuth permission={P.MANAGE_HR}>
      <TeamView />
    </RequireAuth>
  );
}
