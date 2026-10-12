"use client";

// Groupes regionaux de benevoles (MANAGE_VOLUNTEERS) : benevoles par region avec competences,
// disponibilites, heures et dernier engagement ; filtres, export CSV (journalise par l'API),
// fiche individuelle avec saisie des heures hors evenement.
import { useMemo, useState } from "react";
import { Clock, Download, Eye, Plus, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button, DataTable, EmptyState, ErrorState, Input, Modal, PageHeader, PageSkeleton, Select, StatCard, Switch, Textarea,
} from "@/src/components/ui";
import RequireAuth from "@/src/components/RequireAuth";
import { useAsync } from "@/src/hooks/useAsync";
import { useMeta, regionOptions } from "@/src/hooks/useMeta";
import { useFormat } from "@/src/i18n/format";
import { useErrorMessage } from "@/src/i18n/errors";
import { volunteeringApi } from "@/src/services/volunteering";
import { useAlerts } from "@/src/utils/alerts";
import { saveBlob, truncate } from "@/src/utils/format";
import { PERMISSIONS as P } from "@/src/utils/rbac";
import BadgeList from "./BadgeList";
import "./volunteering.css";

const today = () => new Date().toISOString().slice(0, 10);

function HoursForm({ volunteer, onSaved }) {
  const t = useTranslations("volunteering.volunteers.hoursForm");
  const errorText = useErrorMessage();
  const { showError, toast } = useAlerts();
  const [values, setValues] = useState({ mission: "", activityDate: today(), hours: "", description: "" });
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setValues((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await volunteeringApi.addHours({
        userId: volunteer.id,
        mission: values.mission,
        activityDate: values.activityDate,
        hours: Number(String(values.hours).replace(",", ".")),
        description: values.description || null,
      });
      toast(t("saved"));
      setValues({ mission: "", activityDate: today(), hours: "", description: "" });
      onSaved();
    } catch (err) {
      showError(t("failed"), errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <h3 className="adm-form-section">{t("title")}</h3>
      <div className="form-grid">
        <Input label={t("mission")} required maxLength={255} value={values.mission} onChange={set("mission")} placeholder={t("missionPlaceholder")} />
        <Input label={t("date")} type="date" required max={today()} value={values.activityDate} onChange={set("activityDate")} />
        <Input label={t("hours")} required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={values.hours} onChange={set("hours")} hint={t("hoursHint")} />
        <Textarea label={t("description")} full rows={2} maxLength={2000} value={values.description} onChange={set("description")} />
      </div>
      <div className="row">
        <Button type="submit" icon={Plus} loading={busy}>{t("submit")}</Button>
      </div>
    </form>
  );
}

function VolunteerModal({ volunteer, onClose, onChanged }) {
  const t = useTranslations("volunteering.volunteers.detail");
  const tMine = useTranslations("volunteering.mine");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { confirmAction, showError, toast } = useAlerts();
  const { data, loading, error, reload } = useAsync(() => volunteeringApi.volunteer(volunteer.id), [volunteer.id]);
  const hours = (value) => tMine("hours", { hours: f.number(value, { maximumFractionDigits: 2 }) });

  const refresh = () => {
    reload();
    onChanged();
  };

  const remove = async (item) => {
    const ok = await confirmAction(t("deleteTitle"), t("deleteText", { mission: item.title }), t("delete"), { danger: true });
    if (!ok) return;
    try {
      await volunteeringApi.deleteHours(item.mission_id);
      toast(t("deleted"));
      refresh();
    } catch (err) {
      showError(t("deleteFailed"), errorText(err));
    }
  };

  return (
    <Modal open large title={volunteer.name} onClose={onClose} footer={<Button variant="ghost" onClick={onClose}>{t("close")}</Button>}>
      {error ? (
        <ErrorState message={errorText(error)} onRetry={reload} />
      ) : loading && !data ? (
        <PageSkeleton variant="list" rows={3} label={t("loading")} />
      ) : (
        <div className="stack">
          <div className="vol-stats">
            <StatCard icon={Clock} label={tMine("counters.total")} value={hours(data.totals.hours)} tone="accent" />
            <StatCard label={tMine("counters.events")} value={f.number(data.totals.events)} hint={hours(data.totals.eventHours)} />
            <StatCard label={tMine("counters.missions")} value={f.number(data.totals.missions)} hint={hours(data.totals.otherHours)} />
          </div>
          <BadgeList badges={data.badges} />
          <HoursForm volunteer={volunteer} onSaved={refresh} />
          <h3 className="adm-form-section">{t("history")}</h3>
          {data.history.length === 0 ? (
            <p className="muted">{t("noHistory")}</p>
          ) : (
            <ul className="vol-history">
              {data.history.map((item) => (
                <li key={item.id}>
                  <span className="vol-history__date">{f.date(item.day || item.date)}</span>
                  <span className="cell-main">
                    <strong>{item.title}</strong>
                    <span>{tMine(`kinds.${item.kind}`)}{item.description ? ` · ${truncate(item.description, 80)}` : ""}</span>
                  </span>
                  <span className="row">
                    <strong className="vol-history__hours">{hours(item.hours)}</strong>
                    {item.kind === "mission" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Trash2}
                        onClick={() => remove(item)}
                        aria-label={t("deleteNamed", { mission: item.title })}
                        title={t("delete")}
                      />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function VolunteersView() {
  const t = useTranslations("volunteering.volunteers");
  const tMine = useTranslations("volunteering.mine");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { meta } = useMeta();
  const { showError, toast } = useAlerts();
  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");
  const [engaged, setEngaged] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(null);
  const params = useMemo(() => ({
    ...(region ? { region } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(engaged ? { engaged: "1" } : {}),
  }), [region, q, engaged]);
  const { data, loading, error, reload } = useAsync(() => volunteeringApi.volunteers(params), [params.region, params.q, params.engaged]);
  const rows = useMemo(() => data || [], [data]);
  const hours = (value) => tMine("hours", { hours: f.number(value, { maximumFractionDigits: 2 }) });

  const totals = useMemo(() => ({
    people: rows.length,
    hours: rows.reduce((sum, row) => sum + Number(row.total_hours || 0), 0),
    regions: new Set(rows.map((row) => row.region).filter(Boolean)).size,
  }), [rows]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await volunteeringApi.exportVolunteers(params);
      saveBlob(blob, t("csvFile", { date: today() }));
      toast(t("exported"));
    } catch (err) {
      showError(t("exportFailed"), errorText(err));
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: t("columns.volunteer"),
      sortable: true,
      render: (row) => (
        <div className="cell-main">
          <strong>{row.name}</strong>
          <span>{[row.email, row.phone].filter(Boolean).join(" · ")}</span>
        </div>
      ),
    },
    { key: "region", header: t("columns.region"), sortable: true, render: (row) => row.region || t("noRegion") },
    { key: "skills", header: t("columns.skills"), render: (row) => (row.skills ? truncate(row.skills, 80) : "—") },
    { key: "availability", header: t("columns.availability"), render: (row) => row.availability || "—" },
    { key: "total_hours", header: t("columns.hours"), sortable: true, render: (row) => <span className="adm-nowrap">{hours(row.total_hours)}</span> },
    {
      key: "last_activity_at",
      header: t("columns.lastActivity"),
      sortable: true,
      sortValue: (row) => row.last_activity_at || "",
      render: (row) => <span className="adm-nowrap">{row.last_activity_at ? f.date(row.last_activity_at) : t("never")}</span>,
    },
    {
      key: "actions",
      label: t("columns.actions"),
      header: <span className="visually-hidden">{t("columns.actions")}</span>,
      render: (row) => (
        <Button size="sm" variant="ghost" icon={Eye} onClick={() => setOpen(row)} aria-label={t("openNamed", { name: row.name })} title={t("open")} />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={<Button icon={Download} variant="secondary" loading={exporting} onClick={exportCsv} disabled={!rows.length}>{t("export")}</Button>}
      />
      <div className="vol-stats" style={{ marginBottom: 16 }}>
        <StatCard icon={Users} label={t("stats.people")} value={f.number(totals.people)} />
        <StatCard icon={Clock} label={t("stats.hours")} value={hours(totals.hours)} tone="accent" />
        <StatCard label={t("stats.regions")} value={f.number(totals.regions)} />
      </div>
      <div className="vol-filters">
        <Select label={t("filters.region")} placeholder={t("filters.allRegions")} options={regionOptions(meta)} value={region} onChange={(event) => setRegion(event.target.value)} />
        <Input label={t("filters.search")} value={q} maxLength={100} onChange={(event) => setQ(event.target.value)} placeholder={t("filters.searchPlaceholder")} />
        <Switch label={t("filters.engaged")} checked={engaged} onChange={setEngaged} />
      </div>
      {error ? (
        <ErrorState message={errorText(error)} onRetry={reload} />
      ) : loading && !data ? (
        <PageSkeleton variant="table" columns={6} label={t("loading")} />
      ) : rows.length === 0 ? (
        <div className="panel">
          <EmptyState icon={Users} title={t("emptyTitle")} description={t("emptyText")} />
        </div>
      ) : (
        <DataTable columns={columns} rows={rows} pageSize={25} />
      )}
      {open && <VolunteerModal volunteer={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

export default function VolunteersAdmin() {
  return (
    <RequireAuth permission={P.MANAGE_VOLUNTEERS}>
      <VolunteersView />
    </RequireAuth>
  );
}
