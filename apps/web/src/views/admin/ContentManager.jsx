"use client";

import "../../styles/admin-b.css";
import { useCallback, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, ExternalLink, Newspaper, Pencil, Plus, Sprout, MessageSquareQuote, Trash2 } from "lucide-react";
import {
  Badge, Button, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, ProgressBar, StatusBadge, Tabs,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAsync } from "../../hooks/useAsync";
import { adminApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatDate, formatMoney, truncate } from "../../utils/format";
import { PROJECT_STATUS, statusOf } from "../../utils/labels";
import { confirmAction, showError, toast } from "../../utils/alerts";
import { PERMISSIONS as P } from "../../utils/rbac";
import ContentForm, { toFormValues } from "./parts-b/ContentForm";
import { Thumb } from "./parts-b/widgets";

// Parametrage par type de contenu.
const TYPES = {
  projects: {
    title: "Projets et campagnes",
    description: "Présentez vos projets de terrain, leurs résultats et, si besoin, un objectif de collecte.",
    icon: Sprout,
    nameKey: "title",
    create: "Nouveau projet",
    created: "Projet créé",
    the: "le projet",
    empty: "Aucun projet pour le moment",
    emptyHint: "Créez votre premier projet : il pourra recevoir des dons dès sa publication.",
    publicPath: (id) => `/projets/${id}`,
  },
  news: {
    title: "Actualités",
    description: "Partagez les nouvelles de l'association : lancements, résultats, moments forts.",
    icon: Newspaper,
    nameKey: "title",
    create: "Nouvelle actualité",
    created: "Actualité créée",
    the: "l'actualité",
    empty: "Aucune actualité pour le moment",
    emptyHint: "Racontez une avancée récente : les actualités publiées apparaissent sur le site.",
    publicPath: (id) => `/actualites/${id}`,
  },
  testimonials: {
    title: "Témoignages",
    description: "Donnez la parole aux bénéficiaires, bénévoles et partenaires (avec leur accord).",
    icon: MessageSquareQuote,
    nameKey: "author",
    create: "Nouveau témoignage",
    created: "Témoignage créé",
    the: "le témoignage",
    empty: "Aucun témoignage pour le moment",
    emptyHint: "Recueillez les mots d'une personne accompagnée : rien ne parle mieux de votre action.",
    publicPath: null,
  },
};

const PUBLISH_TABS = [
  { value: "all", label: "Tous" },
  { value: "published", label: "Publiés" },
  { value: "draft", label: "Brouillons" },
];

function ContentManagerView({ type }) {
  const config = TYPES[type];
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.content(type), [type]);
  // Les actualites et temoignages peuvent etre lies a un projet.
  const { data: projects } = useAsync(() => adminApi.content("projects"), [], { enabled: type !== "projects" });

  const [tab, setTab] = useState("all");
  const [editing, setEditing] = useState(null); // null | { item } (item null = creation)
  const [busyId, setBusyId] = useState(null);

  const items = useMemo(() => data || [], [data]);
  const counts = {
    all: items.length,
    published: items.filter((item) => item.published).length,
    draft: items.filter((item) => !item.published).length,
  };
  const visible = items.filter((item) => (tab === "all" ? true : tab === "published" ? item.published : !item.published));
  const projectTitle = (id) => (projects || []).find((project) => project.id === id)?.title;

  const closeForm = useCallback(() => setEditing(null), []);

  const upsert = (saved, isUpdate) => {
    setData((prev) => (isUpdate ? prev.map((row) => (row.id === saved.id ? saved : row)) : [saved, ...(prev || [])]));
  };

  const onSaved = (saved, isUpdate) => {
    upsert(saved, isUpdate);
    setEditing(null);
  };

  const togglePublished = async (item) => {
    setBusyId(item.id);
    try {
      const saved = await adminApi.updateContent(type, item.id, { published: !item.published });
      upsert(saved, true);
      toast(saved.published ? "Publié sur le site" : "Repassé en brouillon");
    } catch (err) {
      showError("Modification impossible", getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (item) => {
    setBusyId(item.id);
    try {
      const values = toFormValues(type, item);
      const copy = {
        ...values,
        [config.nameKey]: `${item[config.nameKey]} (copie)`.slice(0, 150),
        image_url: item.image_url || "",
        published: false,
      };
      const saved = await adminApi.createContent(type, copy);
      upsert(saved, false);
      toast("Copie créée en brouillon");
    } catch (err) {
      showError("Duplication impossible", getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item) => {
    const name = item[config.nameKey];
    const extra = type === "projects"
      ? " Les dons déjà reçus sont conservés et rattachés au fonds général. Pour simplement le masquer, repassez-le en brouillon."
      : "";
    const ok = await confirmAction(`Supprimer « ${truncate(name, 60)} » ?`, `Cette suppression est définitive.${extra}`, "Supprimer", {
      danger: true,
    });
    if (!ok) return;
    setBusyId(item.id);
    try {
      await adminApi.deleteContent(type, item.id);
      setData((prev) => prev.filter((row) => row.id !== item.id));
      toast("Contenu supprimé");
    } catch (err) {
      showError("Suppression impossible", getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      key: "name",
      header: type === "testimonials" ? "Auteur" : "Titre",
      sortable: true,
      sortValue: (item) => String(item[config.nameKey] || "").toLowerCase(),
      render: (item) => (
        <div className="admb-title-cell">
          <Thumb src={item.image_url} className={type === "testimonials" ? "admb-thumb admb-thumb--round" : "admb-thumb"} />
          <div className="cell-main">
            <strong>{item[config.nameKey]}</strong>
            <span>
              {type === "testimonials"
                ? item.role_label || truncate(item.content, 70)
                : truncate(item.summary || item.description || item.content, 80)}
            </span>
          </div>
        </div>
      ),
    },
    ...(type === "projects"
      ? [
          {
            key: "status",
            header: "Statut",
            sortable: true,
            render: (item) => <StatusBadge status={statusOf(PROJECT_STATUS, item.status)} />,
          },
          { key: "region", header: "Région", sortable: true, render: (item) => item.region || "—" },
          {
            key: "campaign",
            header: "Campagne",
            sortable: true,
            sortValue: (item) => item.progress ?? -1,
            render: (item) =>
              item.goal_amount ? (
                <div className="admb-campaign">
                  <ProgressBar value={item.progress} accent label={`Collecte : ${item.progress} %`} />
                  <div className="progress-meta">
                    <span><strong>{formatMoney(item.raised_eur)}</strong> / {formatMoney(item.goal_amount)}</span>
                    <span>{item.progress} %</span>
                  </div>
                </div>
              ) : (
                <span className="admb-muted-small">Pas de campagne</span>
              ),
          },
        ]
      : [
          {
            key: "project",
            header: "Projet lié",
            render: (item) => projectTitle(item.project_id) || <span className="muted">—</span>,
          },
          {
            key: "created_at",
            header: "Créé le",
            sortable: true,
            render: (item) => <span className="admb-nowrap">{formatDate(item.created_at)}</span>,
          },
        ]),
    {
      key: "published",
      header: "Publication",
      sortable: true,
      sortValue: (item) => (item.published ? 1 : 0),
      render: (item) => (item.published ? <Badge tone="success">Publié</Badge> : <Badge>Brouillon</Badge>),
    },
    {
      key: "actions",
      header: <span className="visually-hidden">Actions</span>,
      render: (item) => {
        const busy = busyId === item.id;
        const name = item[config.nameKey];
        return (
          <div className="admb-actions">
            <Button
              size="sm"
              variant="ghost"
              icon={item.published ? EyeOff : Eye}
              disabled={busy}
              onClick={() => togglePublished(item)}
              aria-label={item.published ? `Repasser « ${name} » en brouillon` : `Publier « ${name} »`}
              title={item.published ? "Repasser en brouillon" : "Publier"}
            />
            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing({ item })} aria-label={`Modifier « ${name} »`} title="Modifier" />
            <Button
              size="sm"
              variant="ghost"
              icon={Copy}
              disabled={busy}
              onClick={() => duplicate(item)}
              aria-label={`Dupliquer « ${name} » en brouillon`}
              title="Dupliquer en brouillon"
            />
            {config.publicPath && item.published && (
              <Button
                size="sm"
                variant="ghost"
                icon={ExternalLink}
                href={config.publicPath(item.id)}
                target="_blank"
                aria-label={`Voir « ${name} » sur le site`}
                title="Voir sur le site"
              />
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              disabled={busy}
              onClick={() => remove(item)}
              aria-label={`Supprimer « ${name} »`}
              title="Supprimer"
            />
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Contenus"
        title={config.title}
        description={config.description}
        actions={<Button icon={Plus} onClick={() => setEditing({ item: null })}>{config.create}</Button>}
      />

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingState label="Chargement des contenus…" />
      ) : items.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={config.icon}
            title={config.empty}
            description={config.emptyHint}
            action={<Button icon={Plus} onClick={() => setEditing({ item: null })}>{config.create}</Button>}
          />
        </div>
      ) : (
        <>
          <Tabs tabs={PUBLISH_TABS.map((t) => ({ ...t, count: counts[t.value] }))} value={tab} onChange={setTab} label="Filtrer par publication" />
          <DataTable
            columns={columns}
            rows={visible}
            searchKeys={(item) => `${item[config.nameKey]} ${item.summary || ""} ${item.region || ""} ${item.role_label || ""}`}
            searchPlaceholder="Rechercher…"
            emptyTitle={tab === "draft" ? "Aucun brouillon" : "Aucun contenu publié"}
            emptyDescription="Changez d'onglet ou de recherche pour voir les autres contenus."
          />
        </>
      )}

      {editing && (
        <ContentForm
          type={type}
          item={editing.item}
          labels={config}
          projects={projects || []}
          onClose={closeForm}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

export default function ContentManager({ type }) {
  return (
    <RequireAuth permission={P.MANAGE_CONTENT}>
      <ContentManagerView type={type} />
    </RequireAuth>
  );
}
