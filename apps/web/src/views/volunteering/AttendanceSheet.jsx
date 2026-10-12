"use client";

// Appel des participants d'un evenement commence ou passe : present / absent et heures de
// benevolat (par defaut la duree de l'evenement). Affiche aussi la liste d'attente.
import { useMemo, useState } from "react";
import { CheckCheck, Save, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, Badge, Button, EmptyState, ErrorState, SkeletonTable } from "@/src/components/ui";
import { useAsync } from "@/src/hooks/useAsync";
import { useFormat } from "@/src/i18n/format";
import { useErrorMessage } from "@/src/i18n/errors";
import { volunteeringApi } from "@/src/services/volunteering";
import { useAlerts } from "@/src/utils/alerts";
import "./volunteering.css";

const toState = (rows = []) =>
  Object.fromEntries(rows.map((row) => [row.user_id, {
    attendance: row.attendance || null,
    hours: row.hours === null || row.hours === undefined ? "" : String(row.hours),
  }]));

export function useAttendance(eventId) {
  return useAsync(() => volunteeringApi.attendance(eventId), [eventId]);
}

export function WaitlistList({ rows = [] }) {
  const t = useTranslations("volunteering.attendance");
  const f = useFormat();
  if (!rows.length) return <p className="muted">{t("waitlistEmpty")}</p>;
  return (
    <ol className="stack" style={{ gap: 6, paddingLeft: 20 }}>
      {rows.map((row) => (
        <li key={row.id}>
          <strong>{row.name}</strong> · {row.email}
          <span className="muted"> · {t("waitlistSince", { date: f.dateTime(row.created_at) })}</span>
        </li>
      ))}
    </ol>
  );
}

export default function AttendanceSheet({ sheet, loading, error, reload, onSaved }) {
  const t = useTranslations("volunteering.attendance");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { showError, toast } = useAlerts();
  const [state, setState] = useState(() => toState(sheet?.registrations));
  const [saving, setSaving] = useState(false);
  // Nouvelle feuille (chargement, enregistrement) : etat local reinitialise pendant le rendu.
  const [source, setSource] = useState(sheet);
  if (sheet !== source) {
    setSource(sheet);
    setState(toState(sheet?.registrations));
  }

  const rows = useMemo(() => sheet?.registrations || [], [sheet]);
  const defaultHours = sheet?.default_hours ?? 2;

  if (error) return <ErrorState message={errorText(error)} onRetry={reload} />;
  if (loading && !sheet) return <SkeletonTable toolbar={false} columns={3} label={t("loading")} />;
  if (!rows.length) return <EmptyState icon={UserCheck} title={t("emptyTitle")} description={t("emptyText")} />;

  const set = (userId, patch) => setState((prev) => ({ ...prev, [userId]: { ...prev[userId], ...patch } }));
  const allPresent = () =>
    setState((prev) => Object.fromEntries(rows.map((row) => [row.user_id, { ...prev[row.user_id], attendance: "present" }])));

  const save = async () => {
    setSaving(true);
    try {
      const entries = rows.map((row) => {
        const entry = state[row.user_id] || {};
        const hours = String(entry.hours || "").replace(",", ".");
        return {
          userId: row.user_id,
          attendance: entry.attendance || null,
          ...(entry.attendance === "present" && hours ? { hours: Number(hours) } : {}),
        };
      });
      const saved = await volunteeringApi.saveAttendance(sheet.event.id, entries);
      toast(t("saved", { present: saved.summary.present }));
      onSaved?.(saved);
    } catch (err) {
      showError(t("saveFailed"), errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const summary = sheet.summary;
  return (
    <div className="stack">
      {!sheet.can_record && <Alert tone="info">{t("notStarted")}</Alert>}
      <p className="muted">
        {t("summary", {
          present: summary.present,
          absent: summary.absent,
          registered: summary.registered,
          hours: f.number(summary.hours, { maximumFractionDigits: 2 }),
        })}
        {" · "}
        {t("defaultHours", { hours: f.number(defaultHours, { maximumFractionDigits: 2 }) })}
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t("columns.participant")}</th>
              <th scope="col">{t("columns.attendance")}</th>
              <th scope="col">{t("columns.hours")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const entry = state[row.user_id] || {};
              const name = row.name;
              return (
                <tr key={row.user_id}>
                  <td>
                    <div className="cell-main">
                      <strong>{name}</strong>
                      <span>{row.email}</span>
                    </div>
                  </td>
                  <td>
                    <div className="vol-attendance-row" role="group" aria-label={t("attendanceFor", { name })}>
                      <Button
                        size="sm"
                        variant={entry.attendance === "present" ? undefined : "secondary"}
                        aria-pressed={entry.attendance === "present"}
                        disabled={!sheet.can_record}
                        onClick={() => set(row.user_id, { attendance: entry.attendance === "present" ? null : "present" })}
                      >
                        {t("present")}
                      </Button>
                      <Button
                        size="sm"
                        variant={entry.attendance === "absent" ? "danger" : "secondary"}
                        aria-pressed={entry.attendance === "absent"}
                        disabled={!sheet.can_record}
                        onClick={() => set(row.user_id, { attendance: entry.attendance === "absent" ? null : "absent" })}
                      >
                        {t("absent")}
                      </Button>
                      {!entry.attendance && <Badge plain>{t("notMarked")}</Badge>}
                    </div>
                  </td>
                  <td>
                    <input
                      className="input"
                      inputMode="decimal"
                      aria-label={t("hoursFor", { name })}
                      placeholder={String(defaultHours)}
                      disabled={!sheet.can_record || entry.attendance !== "present"}
                      value={entry.attendance === "present" ? entry.hours : ""}
                      onChange={(event) => set(row.user_id, { hours: event.target.value })}
                      style={{ width: "6rem" }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sheet.can_record && (
        <div className="row">
          <Button variant="secondary" icon={CheckCheck} onClick={allPresent}>{t("allPresent")}</Button>
          <Button icon={Save} loading={saving} onClick={save}>{t("save")}</Button>
        </div>
      )}
    </div>
  );
}
