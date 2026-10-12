"use client";

// Administration > Donateurs (permission MANAGE_DONORS) : liste agregee, segments, fiche
// (historique, evenements, notes, etiquettes, preferences) et export CSV d'un segment.
import "../engagement.css";
import { useState } from "react";
import { Download, HeartHandshake, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { DONOR_SEGMENTS } from "@hope/shared/engagement";
import { REGIONS } from "@hope/shared/constants";
import {
  Badge, Button, EmptyState, ErrorState, Input, LoadingState, Modal, PageHeader, PageSkeleton, Select, StatusBadge, Textarea,
} from "../../../components/ui";
import RequireAuth from "../../../components/RequireAuth";
import { useAsync } from "../../../hooks/useAsync";
import { useUrlFilters } from "../../../hooks/useUrlFilters";
import { useErrorMessage } from "../../../i18n/errors";
import { useFormat } from "../../../i18n/format";
import { useAlerts } from "../../../utils/alerts";
import { useLabels } from "../../../utils/labels";
import { PERMISSIONS as P } from "../../../utils/rbac";
import { donorsApi, downloadBlob } from "../../../services/engagement";

const PAGE_SIZE = 50;
const URL_DEFAULTS = { segment: "all", region: "", threshold: "", tag: "", q: "", page: 1 };

function DonorSheet({ donorKey, onClose, onChanged }) {
  const t = useTranslations("engagement.donors.sheet");
  const tt = useTranslations("engagement.topics");
  const f = useFormat();
  const labels = useLabels();
  const errorText = useErrorMessage();
  const { toast, showError } = useAlerts();
  const { data, loading, error, reload, setData } = useAsync(() => donorsApi.get(donorKey), [donorKey]);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (action, after) => {
    setBusy(true);
    try {
      after(await action());
      toast(t("saved"));
      onChanged?.();
    } catch (err) {
      showError(t("error"), errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const donor = data?.donor;
  const tagText = tags ?? (donor?.tags || []).join(", ");

  return (
    <Modal open title={donor?.name || t("title")} onClose={onClose} large closeLabel={t("close")}>
      {loading && !data ? (
        <LoadingState label={t("title")} />
      ) : error ? (
        <ErrorState message={errorText(error)} onRetry={reload} />
      ) : (
        <div className="stack">
          <dl className="dl">
            <dt>Email</dt>
            <dd>{donor.email || "—"}</dd>
            <dt>{t("totalEur")}</dt>
            <dd>{f.money(donor.total_eur, "eur")}</dd>
            <dt>{t("byCurrency")}</dt>
            <dd>{[donor.total_eur_native ? f.money(donor.total_eur_native, "eur") : null, donor.total_xaf ? f.money(donor.total_xaf, "xaf") : null].filter(Boolean).join(" · ") || "—"}</dd>
            <dt>{t("history")}</dt>
            <dd>{t("firstLast", { first: f.date(donor.first_donation_at), last: f.date(donor.last_donation_at) })}</dd>
            <dt>{t("preferences")}</dt>
            <dd className="chip-list">
              {Object.entries(data.preferences || {}).map(([topic, accepted]) => (
                <Badge key={topic} tone={accepted ? "success" : "warning"}>{tt(`${topic}.label`)} : {accepted ? t("accepted") : t("refused")}</Badge>
              ))}
            </dd>
          </dl>

          <section>
            <h3 className="acc-section-title">{t("history")}</h3>
            <div className="table-wrap">
              <table className="table">
                <caption className="visually-hidden">{t("history")}</caption>
                <tbody>
                  {data.donations.map((donation) => (
                    <tr key={donation.id}>
                      <td className="adm-nowrap">{f.date(donation.paid_at || donation.created_at)}</td>
                      <td>{f.money(donation.amount, donation.currency)}</td>
                      <td>{donation.project_title || t("noProject")}</td>
                      <td><StatusBadge status={labels.status("paymentStatus", donation.status)} />{donation.frequency === "monthly" ? " ↻" : ""}</td>
                      <td>{donation.receipt_number ? t("receipt", { number: donation.receipt_number }) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="acc-section-title">{t("events")}</h3>
            {data.events.length ? (
              <ul>
                {data.events.map((event) => <li key={event.id}>{event.title} · {f.date(event.start_at)}</li>)}
              </ul>
            ) : <p className="muted">{t("noEvents")}</p>}
          </section>

          <section className="stack">
            <h3 className="acc-section-title">{t("tags")}</h3>
            <Input label={t("tags")} hint={t("tagsHint")} value={tagText} onChange={(event) => setTags(event.target.value)} />
            <div>
              <Button
                size="sm"
                icon={Save}
                loading={busy}
                onClick={() => run(
                  () => donorsApi.setTags(donorKey, tagText.split(",").map((tag) => tag.trim()).filter(Boolean)),
                  (result) => {
                    setTags(null);
                    setData((prev) => ({ ...prev, donor: { ...prev.donor, tags: result.tags } }));
                  }
                )}
              >
                {t("saveTags")}
              </Button>
            </div>
          </section>

          <section className="stack">
            <h3 className="acc-section-title">{t("notes")}</h3>
            <Textarea label={t("notes")} placeholder={t("notePlaceholder")} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            <div>
              <Button
                size="sm"
                loading={busy}
                disabled={!note.trim()}
                onClick={() => run(() => donorsApi.addNote(donorKey, note.trim()), (notes) => {
                  setNote("");
                  setData((prev) => ({ ...prev, notes }));
                })}
              >
                {t("addNote")}
              </Button>
            </div>
            {data.notes.length ? data.notes.map((item) => (
              <div key={item.id} className="eng-note">
                <div className="eng-note__meta">
                  <span>{item.author_name || "—"} · {f.dateTime(item.created_at)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    aria-label={t("deleteNote")}
                    onClick={() => run(() => donorsApi.removeNote(donorKey, item.id), (notes) => setData((prev) => ({ ...prev, notes })))}
                  />
                </div>
                <p>{item.body}</p>
              </div>
            )) : <p className="muted">{t("noNotes")}</p>}
          </section>
        </div>
      )}
    </Modal>
  );
}

function Donors() {
  const t = useTranslations("engagement.donors");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { showError } = useAlerts();
  const { values, setValues } = useUrlFilters(URL_DEFAULTS);
  const [open, setOpen] = useState(null);
  const [exporting, setExporting] = useState(false);
  const segment = DONOR_SEGMENTS.includes(values.segment) ? values.segment : "all";
  const page = Number(values.page) || 1;
  const params = {
    segment,
    region: values.region || undefined,
    threshold: segment === "major" && values.threshold ? values.threshold : undefined,
    tag: values.tag || undefined,
    q: values.q || undefined,
  };
  const { data, loading, error, reload } = useAsync(
    () => donorsApi.list({ ...params, page, pageSize: PAGE_SIZE }),
    [segment, values.region, values.threshold, values.tag, values.q, page]
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await donorsApi.exportCsv(params);
      downloadBlob(blob, `donateurs-${segment}-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      showError(t("exportError"), errorText(err));
    } finally {
      setExporting(false);
    }
  };

  const setFilter = (key) => (event) => setValues({ ...values, [key]: event.target.value, page: 1 });
  const total = data?.total || 0;

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={<Button variant="secondary" icon={Download} loading={exporting} onClick={exportCsv}>{t("export")}</Button>}
      />
      <div className="eng-filters">
        <Select label={t("segment")} value={segment} onChange={setFilter("segment")} options={DONOR_SEGMENTS.map((value) => ({ value, label: t(`segments.${value}`) }))} />
        <Select label={t("region")} placeholder={t("allRegions")} value={values.region} onChange={setFilter("region")} options={REGIONS.map((value) => ({ value, label: value }))} />
        {segment === "major" && (
          <Input label={t("threshold")} type="number" min="0" inputMode="numeric" placeholder={String(data?.threshold ?? "")} value={values.threshold} onChange={setFilter("threshold")} />
        )}
        <Select label={t("tag")} placeholder={t("allTags")} value={values.tag} onChange={setFilter("tag")} options={(data?.tags || []).map(({ tag, count }) => ({ value: tag, label: `${tag} (${count})` }))} />
        <Input label={t("search")} type="search" value={values.q} onChange={setFilter("q")} data-page-search="" />
      </div>

      {loading && !data ? (
        <PageSkeleton variant="table" columns={6} rows={8} label={t("loading")} />
      ) : error ? (
        <ErrorState message={errorText(error)} onRetry={reload} />
      ) : !data.items.length ? (
        <EmptyState icon={HeartHandshake} title={t("emptyTitle")} description={t("emptyText")} />
      ) : (
        <>
          <p className="muted adm-small">{t("summary", { count: total, amount: f.money(data.totalEur, "eur") })}</p>
          <div className="table-wrap" aria-busy={loading}>
            <table className="table">
              <caption className="visually-hidden">{t("title")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("columns.donor")}</th>
                  <th scope="col">{t("columns.total")}</th>
                  <th scope="col">{t("columns.donations")}</th>
                  <th scope="col">{t("columns.first")}</th>
                  <th scope="col">{t("columns.last")}</th>
                  <th scope="col">{t("columns.status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((donor) => (
                  <tr key={donor.donor_key}>
                    <td>
                      <div className="cell-main">
                        <button type="button" className="btn btn--ghost btn--sm" aria-label={t("open", { name: donor.name || donor.email })} onClick={() => setOpen(donor.donor_key)}>
                          <strong>{donor.name || donor.email}</strong>
                        </button>
                        <span>{donor.email}{donor.region ? ` · ${donor.region}` : ""}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-main">
                        <strong>{f.money(donor.total_eur, "eur")}</strong>
                        {donor.main_currency === "xaf" && <span>{f.money(donor.total_xaf, "xaf")}</span>}
                      </div>
                    </td>
                    <td>{f.number(donor.donations)}</td>
                    <td className="adm-nowrap">{f.date(donor.first_donation_at)}</td>
                    <td className="adm-nowrap">{f.date(donor.last_donation_at)}</td>
                    <td className="chip-list">
                      <Badge tone={donor.user_id ? "brand" : undefined}>{donor.user_id ? t("account") : t("guest")}</Badge>
                      {donor.recurring && <Badge tone="success">{t("recurring")}</Badge>}
                      {donor.tags.map((tag) => <Badge key={tag} plain>{tag}</Badge>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>{t("page", { page })}</span>
            <div className="row">
              <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setValues({ ...values, page: page - 1 })}>{t("previous")}</Button>
              <Button size="sm" variant="secondary" disabled={page * PAGE_SIZE >= total || loading} onClick={() => setValues({ ...values, page: page + 1 })}>{t("next")}</Button>
            </div>
          </div>
        </>
      )}
      {open && <DonorSheet donorKey={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

export default function DonorsView() {
  return (
    <RequireAuth permission={P.MANAGE_DONORS}>
      <Donors />
    </RequireAuth>
  );
}
