"use client";

// Administration > Campagnes (permission MANAGE_CAMPAIGNS) : campagnes (brouillon, apercu, test,
// envoi par lots, statistiques), modeles reutilisables et nouvelles des projets aux donateurs.
import "../engagement.css";
import { useState } from "react";
import { Eye, Megaphone, Newspaper, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CAMPAIGN_AUDIENCES, CONSENT_TOPICS, TEMPLATE_VARIABLES } from "@hope/shared/engagement";
import { REGIONS } from "@hope/shared/constants";
import {
  Badge, Button, EmptyState, ErrorState, Input, LoadingState, Modal, PageHeader, PageSkeleton, Select, TabPanel, Tabs, Textarea,
} from "../../../components/ui";
import RequireAuth from "../../../components/RequireAuth";
import { useAsync } from "../../../hooks/useAsync";
import { useErrorMessage } from "../../../i18n/errors";
import { useFormat } from "../../../i18n/format";
import { useAlerts } from "../../../utils/alerts";
import { PERMISSIONS as P } from "../../../utils/rbac";
import { campaignsApi } from "../../../services/engagement";

const STATUS_TONES = { draft: "warning", sending: "info", sent: "success" };
const EMPTY_CAMPAIGN = { name: "", subject: "", body: "", audience: "newsletter", topic: "newsletter", audienceParams: {} };
const VARIABLES = TEMPLATE_VARIABLES.map((name) => `{${name}}`).join(", ");

function useRunner() {
  const errorText = useErrorMessage();
  const { toast, showError } = useAlerts();
  const t = useTranslations("engagement.campaigns.actions");
  const [busy, setBusy] = useState(false);
  const run = async (action, success) => {
    setBusy(true);
    try {
      const result = await action();
      if (success) toast(typeof success === "function" ? success(result) : success);
      return result;
    } catch (err) {
      showError(t("error"), errorText(err));
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function PreviewModal({ preview, onClose, footer }) {
  const t = useTranslations("engagement.campaigns");
  return (
    <Modal open={Boolean(preview)} title={t("preview.title")} onClose={onClose} large footer={footer} closeLabel={t("preview.close")}>
      {preview && (
        <div className="stack">
          <dl className="dl">
            <dt>{t("preview.subject")}</dt>
            <dd>{preview.subject}</dd>
            <dt>{t("preview.recipients")}</dt>
            <dd>{t("recipientsCount", { count: preview.recipients })}</dd>
          </dl>
          <pre className="eng-preview">{preview.text}</pre>
        </div>
      )}
    </Modal>
  );
}

function CampaignEditor({ campaign, templates, onClose, onSaved }) {
  const t = useTranslations("engagement.campaigns");
  const tt = useTranslations("engagement.topics");
  const tf = useTranslations("engagement.campaigns.form");
  const { busy, run } = useRunner();
  const [form, setForm] = useState(() => (campaign?.id
    ? { name: campaign.name, subject: campaign.subject, body: campaign.body, audience: campaign.audience, topic: campaign.topic, audienceParams: campaign.audience_params || {} }
    : EMPTY_CAMPAIGN));
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const setParam = (key) => (event) => setForm((prev) => ({ ...prev, audienceParams: { ...prev.audienceParams, [key]: event.target.value || undefined } }));
  const isNewsletter = form.audience === "newsletter";

  const applyTemplate = (event) => {
    const template = templates.find((item) => String(item.id) === event.target.value);
    if (template) setForm((prev) => ({ ...prev, subject: template.subject, body: template.body, name: prev.name || template.name }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const payload = { ...form, topic: isNewsletter ? "newsletter" : form.topic };
    if (payload.audienceParams.threshold) payload.audienceParams = { ...payload.audienceParams, threshold: Number(payload.audienceParams.threshold) };
    const saved = await run(() => (campaign?.id ? campaignsApi.update(campaign.id, payload) : campaignsApi.create(payload)), tf("saved"));
    if (saved) onSaved(saved);
  };

  return (
    <Modal
      open
      large
      title={campaign?.id ? tf("editTitle") : tf("createTitle")}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>{tf("cancel")}</Button>
          <Button type="submit" form="eng-campaign-form" loading={busy}>{tf("save")}</Button>
        </>
      )}
    >
      <form id="eng-campaign-form" className="stack" onSubmit={submit} noValidate>
        {templates.length > 0 && (
          <Select label={tf("template")} placeholder={tf("noTemplate")} defaultValue="" onChange={applyTemplate} options={templates.map((item) => ({ value: String(item.id), label: item.name }))} />
        )}
        <Input label={tf("name")} required maxLength={150} value={form.name} onChange={set("name")} />
        <Select
          label={tf("audience")}
          value={form.audience}
          onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value, topic: event.target.value === "newsletter" ? "newsletter" : prev.topic === "newsletter" ? "project_news" : prev.topic, audienceParams: {} }))}
          options={CAMPAIGN_AUDIENCES.map((value) => ({ value, label: t(`audiences.${value}`) }))}
        />
        {form.audience === "donors:region" && (
          <Select label={tf("region")} required placeholder="—" value={form.audienceParams.region || ""} onChange={setParam("region")} options={REGIONS.map((value) => ({ value, label: value }))} />
        )}
        {form.audience === "donors:major" && (
          <Input label={tf("threshold")} type="number" min="0" value={form.audienceParams.threshold ?? ""} onChange={setParam("threshold")} />
        )}
        {!isNewsletter && <Input label={tf("tag")} value={form.audienceParams.tag || ""} onChange={setParam("tag")} />}
        <Select
          label={tf("topic")}
          hint={tf("topicHint")}
          value={isNewsletter ? "newsletter" : form.topic}
          disabled={isNewsletter}
          onChange={set("topic")}
          options={CONSENT_TOPICS.map((value) => ({ value, label: tt(`${value}.label`) }))}
        />
        <Input label={tf("subject")} required maxLength={200} value={form.subject} onChange={set("subject")} />
        <Textarea label={tf("body")} hint={tf("bodyHint", { variables: VARIABLES })} required rows={10} value={form.body} onChange={set("body")} />
      </form>
    </Modal>
  );
}

function CampaignsPanel({ templates }) {
  const t = useTranslations("engagement.campaigns");
  const ta = useTranslations("engagement.campaigns.actions");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { confirmAction } = useAlerts();
  const { busy, run } = useRunner();
  const { data, loading, error, reload } = useAsync(() => campaignsApi.list(), []);
  const subscribers = useAsync(() => campaignsApi.subscribers(), []);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);

  const openPreview = async (campaign) => {
    const result = await run(() => campaignsApi.preview(campaign.id));
    if (result) setPreview({ ...result, campaign });
  };

  const send = async (campaign, recipients) => {
    const ok = await confirmAction(ta("sendConfirmTitle"), ta("sendConfirmText", { count: recipients }), ta("sendConfirm"));
    if (!ok) return;
    const result = await run(() => campaignsApi.send(campaign.id), ta("sent"));
    if (result) {
      setPreview(null);
      reload();
    }
  };

  const remove = async (campaign) => {
    const ok = await confirmAction(ta("deleteConfirmTitle"), ta("deleteConfirmText"), ta("delete"), { danger: true });
    if (ok && (await run(() => campaignsApi.remove(campaign.id), ta("deleted"))) !== null) reload();
  };

  return (
    <div className="stack">
      <div className="table-toolbar">
        <span className="muted adm-small">{subscribers.data ? t("subscribers", { count: subscribers.data.total }) : ""}</span>
        <Button icon={Plus} onClick={() => setEditing({})}>{t("new")}</Button>
      </div>
      {loading && !data ? (
        <PageSkeleton variant="table" columns={5} rows={5} label={t("loading")} />
      ) : error ? (
        <ErrorState message={errorText(error)} onRetry={reload} />
      ) : !data.length ? (
        <EmptyState icon={Megaphone} title={t("emptyTitle")} description={t("emptyText")} />
      ) : (
        <div className="table-wrap" aria-busy={loading || busy}>
          <table className="table">
            <caption className="visually-hidden">{t("tabs.campaigns")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("columns.name")}</th>
                <th scope="col">{t("columns.audience")}</th>
                <th scope="col">{t("columns.status")}</th>
                <th scope="col">{t("columns.date")}</th>
                <th scope="col"><span className="visually-hidden">{ta("edit")}</span></th>
              </tr>
            </thead>
            <tbody>
              {data.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  f={f}
                  busy={busy}
                  onEdit={() => setEditing(campaign)}
                  onPreview={() => openPreview(campaign)}
                  onTest={() => run(() => campaignsApi.sendTest(campaign.id), (result) => (result.sent ? ta("testSent") : ta("testNotSent")))}
                  onDelete={() => remove(campaign)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <CampaignEditor
          campaign={editing}
          templates={templates}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      <PreviewModal
        preview={preview}
        onClose={() => setPreview(null)}
        footer={preview?.campaign?.status === "draft" && (
          <Button icon={Send} loading={busy} disabled={!preview.recipients} onClick={() => send(preview.campaign, preview.recipients)}>{ta("send")}</Button>
        )}
      />
    </div>
  );
}

function CampaignRow({ campaign, f, busy, onEdit, onPreview, onTest, onDelete }) {
  const t = useTranslations("engagement.campaigns");
  const ta = useTranslations("engagement.campaigns.actions");
  // Statistiques detaillees (envoyes, echecs, desinscriptions) chargees pour les campagnes envoyees.
  const stats = useAsync(() => campaignsApi.get(campaign.id).then((detail) => detail.stats), [campaign.id, campaign.status], { enabled: campaign.status !== "draft" });
  const draft = campaign.status === "draft";
  return (
    <tr>
      <td>
        <div className="cell-main">
          <strong>{campaign.name}</strong>
          <span>{campaign.subject}</span>
          {stats.data && <span>{t("stats", stats.data)}</span>}
        </div>
      </td>
      <td>{t(`audiences.${campaign.audience}`)}</td>
      <td><Badge tone={STATUS_TONES[campaign.status]}>{t(`status.${campaign.status}`)}</Badge></td>
      <td className="adm-nowrap">{f.date(campaign.sent_at || campaign.created_at)}</td>
      <td>
        <div className="eng-row-actions">
          <Button size="sm" variant="secondary" icon={Eye} disabled={busy} onClick={onPreview}>{ta("preview")}</Button>
          <Button size="sm" variant="ghost" icon={Send} disabled={busy} onClick={onTest}>{ta("test")}</Button>
          {draft && <Button size="sm" variant="ghost" icon={Pencil} onClick={onEdit}>{ta("edit")}</Button>}
          {draft && <Button size="sm" variant="ghost" icon={Trash2} onClick={onDelete}>{ta("delete")}</Button>}
        </div>
      </td>
    </tr>
  );
}

function TemplatesPanel({ templates, reload }) {
  const t = useTranslations("engagement.campaigns.templates");
  const tf = useTranslations("engagement.campaigns.form");
  const { confirmAction } = useAlerts();
  const { busy, run } = useRunner();
  const [editing, setEditing] = useState(null);

  const save = async (event) => {
    event.preventDefault();
    const payload = { name: editing.name, subject: editing.subject, body: editing.body };
    const result = await run(() => (editing.id ? campaignsApi.updateTemplate(editing.id, payload) : campaignsApi.createTemplate(payload)), t("saved"));
    if (result) {
      setEditing(null);
      reload();
    }
  };

  const remove = async (template) => {
    if (!(await confirmAction(t("deleteConfirm"), template.name, t("delete"), { danger: true }))) return;
    if ((await run(() => campaignsApi.removeTemplate(template.id), t("deleted"))) !== null) reload();
  };

  const set = (key) => (event) => setEditing((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <div className="stack">
      <div className="table-toolbar">
        <span />
        <Button icon={Plus} onClick={() => setEditing({ name: "", subject: "", body: "" })}>{t("new")}</Button>
      </div>
      {!templates.length ? (
        <EmptyState icon={Pencil} title={t("emptyTitle")} description={t("emptyText")} />
      ) : (
        <ul className="eng-topics">
          {templates.map((template) => (
            <li key={template.id} className="eng-topic">
              <span className="eng-topic__text">
                <strong>{template.name}</strong>
                <span>{template.subject}</span>
              </span>
              <span className="eng-row-actions">
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(template)}>{t("edit")}</Button>
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(template)}>{t("delete")}</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={Boolean(editing)}
        large
        title={editing?.id ? t("editTitle") : t("createTitle")}
        onClose={() => setEditing(null)}
        footer={(
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>{tf("cancel")}</Button>
            <Button type="submit" form="eng-template-form" loading={busy}>{tf("save")}</Button>
          </>
        )}
      >
        {editing && (
          <form id="eng-template-form" className="stack" onSubmit={save} noValidate>
            <Input label={t("name")} required maxLength={150} value={editing.name} onChange={set("name")} />
            <Input label={tf("subject")} required maxLength={200} value={editing.subject} onChange={set("subject")} />
            <Textarea label={tf("body")} hint={tf("bodyHint", { variables: VARIABLES })} required rows={10} value={editing.body} onChange={set("body")} />
          </form>
        )}
      </Modal>
    </div>
  );
}

function ProjectNewsPanel() {
  const t = useTranslations("engagement.campaigns.projectNews");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { confirmAction } = useAlerts();
  const { busy, run } = useRunner();
  const { data, loading, error, reload } = useAsync(() => campaignsApi.projectNews(), []);
  const [preview, setPreview] = useState(null);

  const open = async (item) => {
    const result = await run(() => campaignsApi.previewProjectNews(item.id));
    if (result) setPreview({ ...result, item });
  };

  const send = async () => {
    if (!(await confirmAction(t("sendConfirmTitle"), preview.subject, t("send")))) return;
    const result = await run(() => campaignsApi.sendProjectNews(preview.item.id), (res) => t("sent", { count: res.recipients }));
    if (result) {
      setPreview(null);
      reload();
    }
  };

  return (
    <div className="stack">
      <p className="muted">{t("text")}</p>
      {loading && !data ? (
        <LoadingState label={t("preview")} />
      ) : error ? (
        <ErrorState message={errorText(error)} onRetry={reload} />
      ) : !data.length ? (
        <EmptyState icon={Newspaper} title={t("emptyTitle")} description={t("emptyText")} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">{t("text")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("columns.news")}</th>
                <th scope="col">{t("columns.project")}</th>
                <th scope="col">{t("columns.status")}</th>
                <th scope="col"><span className="visually-hidden">{t("preview")}</span></th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="cell-main">
                      <strong>{item.title}</strong>
                      <span>{f.date(item.created_at)}</span>
                    </div>
                  </td>
                  <td>{item.project_title}</td>
                  <td>
                    {item.dispatched_at
                      ? <Badge tone="success">{t("sentOn", { date: f.date(item.dispatched_at), count: Number(item.dispatched_recipients) || 0 })}</Badge>
                      : <Badge tone="warning">{t("notSent")}</Badge>}
                  </td>
                  <td>
                    {!item.dispatched_at && <Button size="sm" variant="secondary" icon={Eye} disabled={busy} onClick={() => open(item)}>{t("preview")}</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PreviewModal
        preview={preview}
        onClose={() => setPreview(null)}
        footer={preview && !preview.dispatched && (
          <Button icon={Send} loading={busy} disabled={!preview.recipients} onClick={send}>{t("send")}</Button>
        )}
      />
    </div>
  );
}

const TABS = ["campaigns", "templates", "projectNews"];

function Campaigns() {
  const t = useTranslations("engagement.campaigns");
  const [tab, setTab] = useState("campaigns");
  const templates = useAsync(() => campaignsApi.templates(), []);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <Tabs id="eng-campaign-tabs" tabs={TABS.map((value) => ({ value, label: t(`tabs.${value}`) }))} value={tab} onChange={setTab} label={t("tabsLabel")} />
      <TabPanel tabsId="eng-campaign-tabs" value={tab}>
        {tab === "campaigns" && <CampaignsPanel templates={templates.data || []} />}
        {tab === "templates" && <TemplatesPanel templates={templates.data || []} reload={templates.reload} />}
        {tab === "projectNews" && <ProjectNewsPanel />}
      </TabPanel>
    </>
  );
}

export default function CampaignsView() {
  return (
    <RequireAuth permission={P.MANAGE_CAMPAIGNS}>
      <Campaigns />
    </RequireAuth>
  );
}
