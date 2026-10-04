"use client";

import { useCallback, useMemo, useState } from "react";
import { Copy, Eye, EyeOff, ExternalLink, Newspaper, Pencil, Plus, Sprout, MessageSquareQuote, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { isRegionScoped } from "@hope/shared/rbac";
import {
  Alert, Badge, Button, DataTable, EmptyState, ErrorState, PageSkeleton, PageHeader, ProgressBar, StatusBadge, TabPanel, Tabs,
} from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useFormat } from "../../i18n/format";
import { useLocalePath } from "../../i18n/navigation";
import { adminApi } from "../../services";
import { useErrorMessage } from "../../i18n/errors";
import { truncate } from "../../utils/format";
import { useLabels } from "../../utils/labels";
import { useAlerts } from "../../utils/alerts";
import { PERMISSIONS as P } from "../../utils/rbac";
import ContentForm, { toFormValues } from "./parts-b/ContentForm";
import { Thumb } from "./parts-b/widgets";

// Parametrage par type de contenu (libelles : adminOps.content.<type>).
const TYPES = {
  projects: { icon: Sprout, nameKey: "title", publicPath: (id) => `/projets/${id}` },
  news: { icon: Newspaper, nameKey: "title", publicPath: (id) => `/actualites/${id}` },
  testimonials: { icon: MessageSquareQuote, nameKey: "author", publicPath: null },
};

const PUBLISH_TABS = ["all", "published", "draft"];

function ContentManagerView({ type }) {
  const getErrorMessage = useErrorMessage();
  const config = TYPES[type];
  const t = useTranslations("adminOps.content");
  const tType = useTranslations(`adminOps.content.types.${type}`);
  const f = useFormat();
  const labels = useLabels();
  const lp = useLocalePath();
  const { confirmAction, showError, toast } = useAlerts();
  const { user } = useAuth();
  // Directrice regionale : contenus limites a sa region (l'API filtre et controle).
  const scopedRegion = isRegionScoped(user?.roles) ? user?.region || "" : null;

  const { data, loading, error, reload, setData } = useAsync(() => adminApi.content(type), [type]);
  // Les actualites et temoignages peuvent etre lies a un projet (liste deja filtree par l'API).
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
  const needsProject = scopedRegion !== null && type !== "projects";
  const noProjectAvailable = needsProject && projects && projects.length === 0;

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
      toast(saved.published ? t("toast.published") : t("toast.unpublished"));
    } catch (err) {
      showError(t("errors.update"), getErrorMessage(err));
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
        [config.nameKey]: t("copyName", { name: item[config.nameKey] }).slice(0, 150),
        image_url: item.image_url || "",
        published: false,
      };
      const saved = await adminApi.createContent(type, copy);
      upsert(saved, false);
      toast(t("toast.duplicated"));
    } catch (err) {
      showError(t("errors.duplicate"), getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item) => {
    const name = truncate(item[config.nameKey], 60);
    const ok = await confirmAction(
      t("delete.title", { name }),
      type === "projects" ? t("delete.textProject") : t("delete.text"),
      t("delete.confirm"),
      { danger: true }
    );
    if (!ok) return;
    setBusyId(item.id);
    try {
      await adminApi.deleteContent(type, item.id);
      setData((prev) => prev.filter((row) => row.id !== item.id));
      toast(t("toast.deleted"));
    } catch (err) {
      showError(t("errors.delete"), getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      key: "name",
      header: type === "testimonials" ? t("columns.author") : t("columns.title"),
      sortable: true,
      sortValue: (item) => String(item[config.nameKey] || "").toLowerCase(),
      render: (item) => (
        <div className="adm-title-cell">
          <Thumb src={item.image_url} className={type === "testimonials" ? "adm-thumb adm-thumb--round" : "adm-thumb"} />
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
            header: t("columns.status"),
            sortable: true,
            render: (item) => <StatusBadge status={labels.status("projectStatus", item.status)} />,
          },
          { key: "region", header: t("columns.region"), sortable: true, render: (item) => item.region || "—" },
          {
            key: "campaign",
            header: t("columns.campaign"),
            sortable: true,
            sortValue: (item) => item.progress ?? -1,
            render: (item) =>
              item.goal_amount ? (
                <div className="adm-campaign">
                  <ProgressBar value={item.progress} accent label={t("campaignProgress", { progress: Number(item.progress) || 0 })} />
                  <div className="progress-meta">
                    <span><strong>{f.money(item.raised_eur)}</strong> / {f.money(item.goal_amount)}</span>
                    <span>{f.number((Number(item.progress) || 0) / 100, { style: "percent", maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              ) : (
                <span className="adm-muted-small">{t("noCampaign")}</span>
              ),
          },
        ]
      : [
          {
            key: "project",
            header: t("columns.project"),
            render: (item) => projectTitle(item.project_id) || <span className="muted">—</span>,
          },
          {
            key: "created_at",
            header: t("columns.createdAt"),
            sortable: true,
            render: (item) => <span className="adm-nowrap">{f.date(item.created_at)}</span>,
          },
        ]),
    {
      key: "published",
      header: t("columns.published"),
      sortable: true,
      sortValue: (item) => (item.published ? 1 : 0),
      render: (item) => (item.published ? <Badge tone="success">{t("published")}</Badge> : <Badge>{t("draft")}</Badge>),
    },
    {
      key: "actions",
      label: t("columns.actions"),
      header: <span className="visually-hidden">{t("columns.actions")}</span>,
      render: (item) => {
        const busy = busyId === item.id;
        const name = item[config.nameKey];
        return (
          <div className="adm-actions">
            <Button
              size="sm"
              variant="ghost"
              icon={item.published ? EyeOff : Eye}
              disabled={busy}
              onClick={() => togglePublished(item)}
              aria-label={item.published ? t("actions.unpublishNamed", { name }) : t("actions.publishNamed", { name })}
              title={item.published ? t("actions.unpublish") : t("actions.publish")}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={Pencil}
              onClick={() => setEditing({ item })}
              aria-label={t("actions.editNamed", { name })}
              title={t("actions.edit")}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={Copy}
              disabled={busy}
              onClick={() => duplicate(item)}
              aria-label={t("actions.duplicateNamed", { name })}
              title={t("actions.duplicate")}
            />
            {config.publicPath && item.published && (
              <Button
                size="sm"
                variant="ghost"
                icon={ExternalLink}
                href={lp(config.publicPath(item.id))}
                target="_blank"
                aria-label={t("actions.viewNamed", { name })}
                title={t("actions.view")}
              />
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={Trash2}
              disabled={busy}
              onClick={() => remove(item)}
              aria-label={t("actions.deleteNamed", { name })}
              title={t("actions.delete")}
            />
          </div>
        );
      },
    },
  ];

  const createButton = (
    <Button icon={Plus} onClick={() => setEditing({ item: null })} disabled={noProjectAvailable}>{tType("create")}</Button>
  );

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={tType("title")} description={tType("description")} actions={createButton} />

      {scopedRegion !== null && (
        <Alert tone="info" title={scopedRegion ? t("scope.title", { region: scopedRegion }) : t("scope.noRegionTitle")}>
          {!scopedRegion ? t("scope.noRegion") : type === "projects" ? t("scope.projects") : t("scope.linked")}
          {noProjectAvailable && ` ${t("scope.noProject")}`}
        </Alert>
      )}

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading && !data ? (
        <PageSkeleton variant="table" columns={5} label={t("loading")} />
      ) : items.length === 0 ? (
        <div className="panel">
          <EmptyState icon={config.icon} title={tType("empty")} description={tType("emptyHint")} action={createButton} />
        </div>
      ) : (
        <>
          <Tabs
            id="content-tabs"
            tabs={PUBLISH_TABS.map((value) => ({ value, label: t(`tabs.${value}`), count: counts[value] }))}
            value={tab}
            onChange={setTab}
            label={t("tabs.label")}
          />
          <TabPanel tabsId="content-tabs" value={tab}>
          <DataTable
            columns={columns}
            rows={visible}
            searchKeys={(item) => `${item[config.nameKey]} ${item.summary || ""} ${item.region || ""} ${item.role_label || ""}`}
            searchPlaceholder={t("search")}
            emptyTitle={tab === "draft" ? t("emptyTab.draft") : t("emptyTab.published")}
            emptyDescription={t("emptyTab.text")}
          />
          </TabPanel>
        </>
      )}

      {editing && (
        <ContentForm
          type={type}
          item={editing.item}
          projects={projects || []}
          scopedRegion={scopedRegion}
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
