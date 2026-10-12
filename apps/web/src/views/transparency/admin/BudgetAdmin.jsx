"use client";

// Budget previsionnel et depenses par projet (finance) : vue d'ensemble des ecarts, lignes de
// budget, depenses avec justificatif (PDF ou image), export "bailleurs" (CSV) par periode.
import "@/src/styles/transparency.css";
import { useMemo, useState } from "react";
import { Download, FileDown, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { EXPENSE_CATEGORIES } from "@hope/shared/transparency";
import {
  Alert, Badge, Button, EmptyState, ErrorState, Input, Modal, PageHeader, PageSkeleton, Select, StatCard, Textarea,
} from "@/src/components/ui";
import RequireAuth from "@/src/components/RequireAuth";
import { useAsync } from "@/src/hooks/useAsync";
import { useFormat } from "@/src/i18n/format";
import { useErrorMessage } from "@/src/i18n/errors";
import { transparencyApi } from "@/src/services/transparency";
import { saveBlob } from "@/src/utils/format";
import { useAlerts } from "@/src/utils/alerts";
import { PERMISSIONS as P } from "@/src/utils/rbac";
import { varianceTone } from "../helpers";
import AdminTabs from "./AdminTabs";

const CURRENCIES = ["eur", "xaf"];
const today = () => new Date().toISOString().slice(0, 10);

function useCategoryOptions() {
  const t = useTranslations("transparency.categories");
  return EXPENSE_CATEGORIES.map((value) => ({ value, label: t(value) }));
}

function Variance({ planned, spent }) {
  const t = useTranslations("transparency.admin.budget");
  const f = useFormat();
  const diff = spent - planned;
  return (
    <Badge tone={varianceTone(planned, spent)}>
      {diff > 0 ? "+" : ""}{f.money(Math.round(diff), "eur")}
      <span className="visually-hidden"> {diff > 0 ? t("overBudget") : t("underBudget")}</span>
    </Badge>
  );
}

// ---------- Ligne de budget (ajout / modification) ----------

function LineForm({ projectId, line, onDone, onCancel }) {
  const t = useTranslations("transparency.admin.budget.lineForm");
  const tCommon = useTranslations("transparency.admin.common");
  const getErrorMessage = useErrorMessage();
  const { toast, showError } = useAlerts();
  const categories = useCategoryOptions();
  const [form, setForm] = useState({
    category: line?.category || "training",
    label: line?.label || "",
    amount: line ? String(line.amount) : "",
    currency: line?.currency || "eur",
  });
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(String(form.amount).replace(",", ".")), label: form.label || null };
      if (line) await transparencyApi.updateLine(line.id, payload);
      else await transparencyApi.createLine(projectId, payload);
      toast(tCommon("saved"));
      onDone();
    } catch (error) {
      showError(tCommon("saveFailed"), getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="tp-line-form" onSubmit={submit}>
      <Select label={t("category")} value={form.category} onChange={set("category")} options={categories} required />
      <Input label={t("label")} value={form.label} onChange={set("label")} maxLength={255} hint={t("labelHint")} />
      <Input label={t("amount")} value={form.amount} onChange={set("amount")} inputMode="decimal" required />
      <Select label={t("currency")} value={form.currency} onChange={set("currency")} options={CURRENCIES.map((value) => ({ value, label: value.toUpperCase() }))} />
      <div className="tp-line-form__actions">
        <Button type="submit" loading={saving} icon={line ? Pencil : Plus}>{line ? tCommon("save") : t("add")}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>{tCommon("cancel")}</Button>}
      </div>
    </form>
  );
}

// ---------- Depense (modale) ----------

function ExpenseModal({ open, expense, projects, defaultProjectId, allowGeneral, onClose, onDone }) {
  const t = useTranslations("transparency.admin.budget.expenseForm");
  const tCommon = useTranslations("transparency.admin.common");
  const getErrorMessage = useErrorMessage();
  const { toast, showError } = useAlerts();
  const categories = useCategoryOptions();
  const [form, setForm] = useState(() => ({
    projectId: expense ? String(expense.project_id || "") : String(defaultProjectId || ""),
    category: expense?.category || "training",
    amount: expense ? String(expense.amount) : "",
    currency: expense?.currency || "eur",
    spentOn: expense?.spent_on || today(),
    description: expense?.description || "",
    receipt: null,
    removeReceipt: false,
  }));
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const projectOptions = [
    ...(allowGeneral ? [{ value: "", label: t("generalCosts") }] : []),
    ...projects.map((project) => ({ value: String(project.id), label: project.title })),
  ];

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        projectId: form.projectId || "",
        category: form.category,
        amount: Number(String(form.amount).replace(",", ".")),
        currency: form.currency,
        spentOn: form.spentOn,
        description: form.description,
        receipt: form.receipt || undefined,
        removeReceipt: expense && form.removeReceipt && !form.receipt ? true : undefined,
      };
      if (expense) await transparencyApi.updateExpense(expense.id, payload);
      else await transparencyApi.createExpense(payload);
      toast(tCommon("saved"));
      onDone();
    } catch (error) {
      showError(tCommon("saveFailed"), getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expense ? t("editTitle") : t("addTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{tCommon("cancel")}</Button>
          <Button type="submit" form="tp-expense-form" loading={saving}>{tCommon("save")}</Button>
        </>
      }
    >
      <form id="tp-expense-form" className="form-grid" onSubmit={submit}>
        <Select label={t("project")} value={form.projectId} onChange={set("projectId")} options={projectOptions} required={!allowGeneral} full />
        <Select label={t("category")} value={form.category} onChange={set("category")} options={categories} required />
        <Input label={t("date")} type="date" value={form.spentOn} onChange={set("spentOn")} max={today()} required />
        <Input label={t("amount")} value={form.amount} onChange={set("amount")} inputMode="decimal" required />
        <Select label={t("currency")} value={form.currency} onChange={set("currency")} options={CURRENCIES.map((value) => ({ value, label: value.toUpperCase() }))} />
        <Textarea label={t("description")} value={form.description} onChange={set("description")} minLength={3} maxLength={500} rows={3} required full />
        <Input
          label={t("receipt")}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
          hint={t("receiptHint")}
          onChange={(event) => setForm((current) => ({ ...current, receipt: event.target.files?.[0] || null }))}
          full
        />
        {expense?.has_receipt && (
          <label className="choice">
            <input type="checkbox" checked={form.removeReceipt} onChange={(event) => setForm((current) => ({ ...current, removeReceipt: event.target.checked }))} />
            {t("removeReceipt")}
          </label>
        )}
      </form>
    </Modal>
  );
}

// ---------- Detail d'un projet ----------

function ProjectBudget({ projectId, projects, allowGeneral, onChanged }) {
  const t = useTranslations("transparency.admin.budget");
  const tCat = useTranslations("transparency.categories");
  const tCommon = useTranslations("transparency.admin.common");
  const f = useFormat();
  const getErrorMessage = useErrorMessage();
  const { toast, showError, confirmAction } = useAlerts();
  const { data, loading, error, reload } = useAsync(() => transparencyApi.projectBudget(projectId), [projectId]);
  const [editingLine, setEditingLine] = useState(null);
  const [expenseModal, setExpenseModal] = useState(null);
  const [period, setPeriod] = useState({ from: "", to: "" });
  const [exporting, setExporting] = useState(false);

  const refresh = () => {
    reload();
    onChanged();
  };

  const remove = async (kind, item) => {
    const ok = await confirmAction(t(`confirm.${kind}Title`), t(`confirm.${kind}Text`), tCommon("delete"));
    if (!ok) return;
    try {
      if (kind === "line") await transparencyApi.deleteLine(item.id);
      else await transparencyApi.deleteExpense(item.id);
      toast(tCommon("deleted"));
      refresh();
    } catch (err) {
      showError(tCommon("deleteFailed"), getErrorMessage(err));
    }
  };

  const downloadReceipt = async (expense) => {
    try {
      saveBlob(await transparencyApi.receipt(expense.id), expense.receipt_name || `justificatif-${expense.id}`);
    } catch (err) {
      showError(tCommon("downloadFailed"), getErrorMessage(err));
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = Object.fromEntries(Object.entries(period).filter(([, value]) => value));
      const blob = await transparencyApi.exportDonorReport(projectId, params);
      saveBlob(blob, t("export.filename", { id: projectId, period: [period.from, period.to].filter(Boolean).join("_") || "complet" }));
      toast(t("export.done"));
    } catch (err) {
      showError(t("export.failed"), getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  if (error) return <ErrorState message={getErrorMessage(error)} onRetry={reload} />;
  if (loading || !data) return <PageSkeleton variant="table" label={t("loading")} />;
  const { project, lines, expenses, byCategory, totals } = data;

  return (
    <section className="panel" aria-labelledby="tp-project-title">
      <div className="panel__head">
        <div>
          <h2 id="tp-project-title" className="panel__title">{project.title}</h2>
          <p className="panel__desc">{project.region || t("noRegion")} · {t("raised", { amount: f.money(Math.round(project.raisedEur), "eur") })}</p>
        </div>
      </div>

      <div className="admin-grid-stats">
        <StatCard label={t("planned")} value={f.money(Math.round(totals.plannedEur), "eur")} icon={Wallet} />
        <StatCard label={t("spent")} value={f.money(Math.round(totals.spentEur), "eur")} icon={Wallet} tone="accent" />
        <StatCard label={t("variance")} value={f.money(Math.round(totals.varianceEur), "eur")} hint={totals.rate === null ? t("noBudget") : t("rate", { rate: totals.rate })} icon={Wallet} tone="info" />
      </div>

      <h3 className="tp-admin-subtitle">{t("byCategory")}</h3>
      {byCategory.length === 0 ? (
        <p className="muted">{t("noLines")}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">{t("byCategory")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("category")}</th>
                <th scope="col" className="num">{t("planned")}</th>
                <th scope="col" className="num">{t("spent")}</th>
                <th scope="col" className="num">{t("variance")}</th>
                <th scope="col" className="num">{t("rateHeader")}</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((row) => (
                <tr key={row.category}>
                  <th scope="row">{tCat(row.category)}</th>
                  <td className="num">{f.money(Math.round(row.plannedEur), "eur")}</td>
                  <td className="num">{f.money(Math.round(row.spentEur), "eur")}</td>
                  <td className="num"><Variance planned={row.plannedEur} spent={row.spentEur} /></td>
                  <td className="num">{row.rate === null ? "—" : `${f.number(row.rate)} %`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="tp-admin-subtitle">{t("lines")}</h3>
      {lines.length > 0 && (
        <ul className="tp-lines">
          {lines.map((line) => (
            <li key={line.id}>
              {editingLine === line.id ? (
                <LineForm projectId={projectId} line={line} onDone={() => { setEditingLine(null); refresh(); }} onCancel={() => setEditingLine(null)} />
              ) : (
                <>
                  <span><strong>{tCat(line.category)}</strong>{line.label ? ` — ${line.label}` : ""}</span>
                  <span className="num">{f.money(line.amount, line.currency)}</span>
                  <span className="tp-row-actions">
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditingLine(line.id)} aria-label={tCommon("editNamed", { name: tCat(line.category) })} />
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove("line", line)} aria-label={tCommon("deleteNamed", { name: tCat(line.category) })} />
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <LineForm key={lines.length} projectId={projectId} onDone={refresh} />

      <div className="tp-admin-row">
        <h3 className="tp-admin-subtitle">{t("expenses")}</h3>
        <Button icon={Plus} onClick={() => setExpenseModal({})}>{t("addExpense")}</Button>
      </div>
      {expenses.length === 0 ? (
        <p className="muted">{t("noExpenses")}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">{t("expenses")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("date")}</th>
                <th scope="col">{t("category")}</th>
                <th scope="col">{t("descriptionHeader")}</th>
                <th scope="col" className="num">{t("amount")}</th>
                <th scope="col">{t("receipt")}</th>
                <th scope="col"><span className="visually-hidden">{tCommon("actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{f.date(expense.spent_on)}</td>
                  <td>{tCat(expense.category)}</td>
                  <td>{expense.description}</td>
                  <td className="num">{f.money(expense.amount, expense.currency)}</td>
                  <td>
                    {expense.has_receipt ? (
                      <Button variant="ghost" size="sm" icon={FileDown} onClick={() => downloadReceipt(expense)}>{t("download")}</Button>
                    ) : (
                      <Badge tone="warning">{t("missingReceipt")}</Badge>
                    )}
                  </td>
                  <td className="tp-row-actions">
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setExpenseModal({ expense })} aria-label={tCommon("editNamed", { name: expense.description })} />
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove("expense", expense)} aria-label={tCommon("deleteNamed", { name: expense.description })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="tp-export">
        <h3 className="tp-admin-subtitle">{t("export.title")}</h3>
        <p className="panel__desc">{t("export.text")}</p>
        <div className="tp-export__fields">
          <Input label={t("export.from")} type="date" value={period.from} onChange={(event) => setPeriod((p) => ({ ...p, from: event.target.value }))} />
          <Input label={t("export.to")} type="date" value={period.to} onChange={(event) => setPeriod((p) => ({ ...p, to: event.target.value }))} />
          <Button variant="secondary" icon={Download} loading={exporting} onClick={exportCsv}>{t("export.button")}</Button>
        </div>
        <p className="tp-footnote">{t("export.logged")}</p>
      </div>

      {expenseModal && (
        <ExpenseModal
          open
          expense={expenseModal.expense}
          projects={projects}
          defaultProjectId={projectId}
          allowGeneral={allowGeneral}
          onClose={() => setExpenseModal(null)}
          onDone={() => { setExpenseModal(null); refresh(); }}
        />
      )}
    </section>
  );
}

// ---------- Vue d'ensemble ----------

function BudgetView() {
  const t = useTranslations("transparency.admin.budget");
  const f = useFormat();
  const getErrorMessage = useErrorMessage();
  const { data, loading, error, reload } = useAsync(() => transparencyApi.budgetProjects(), []);
  const [selected, setSelected] = useState(null);
  const [generalModal, setGeneralModal] = useState(false);
  const projects = useMemo(() => data?.projects || [], [data]);
  const allowGeneral = Boolean(data) && data.region === null;

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <AdminTabs />
      {data?.region && <Alert tone="info" title={t("scopedTitle", { region: data.region })}>{t("scopedText")}</Alert>}

      {error ? (
        <ErrorState message={getErrorMessage(error)} onRetry={reload} />
      ) : loading || !data ? (
        <PageSkeleton variant="table" label={t("loading")} />
      ) : projects.length === 0 ? (
        <div className="panel"><EmptyState icon={Wallet} title={t("emptyTitle")} description={t("emptyText")} /></div>
      ) : (
        <section className="panel" aria-labelledby="tp-overview-title" style={{ marginBottom: 24 }}>
          <div className="panel__head">
            <div>
              <h2 id="tp-overview-title" className="panel__title">{t("overviewTitle")}</h2>
              <p className="panel__desc">{t("overviewText")}</p>
            </div>
            {allowGeneral && (
              <div className="tp-general">
                <span>{t("generalCosts", { amount: f.money(Math.round(data.generalCostsEur || 0), "eur") })}</span>
                <Button variant="secondary" size="sm" icon={Plus} onClick={() => setGeneralModal(true)}>{t("addGeneral")}</Button>
              </div>
            )}
          </div>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">{t("overviewTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("project")}</th>
                  <th scope="col">{t("region")}</th>
                  <th scope="col" className="num">{t("planned")}</th>
                  <th scope="col" className="num">{t("spent")}</th>
                  <th scope="col" className="num">{t("variance")}</th>
                  <th scope="col"><span className="visually-hidden">{t("manage")}</span></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className={selected === project.id ? "is-selected" : undefined}>
                    <th scope="row">{project.title}</th>
                    <td>{project.region || "—"}</td>
                    <td className="num">{f.money(Math.round(project.plannedEur), "eur")}</td>
                    <td className="num">{f.money(Math.round(project.spentEur), "eur")}</td>
                    <td className="num"><Variance planned={project.plannedEur} spent={project.spentEur} /></td>
                    <td>
                      <Button
                        size="sm"
                        variant={selected === project.id ? undefined : "secondary"}
                        aria-pressed={selected === project.id}
                        onClick={() => setSelected(project.id)}
                        aria-label={t("manageNamed", { title: project.title })}
                      >
                        {t("manage")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected && <ProjectBudget key={selected} projectId={selected} projects={projects} allowGeneral={allowGeneral} onChanged={reload} />}

      {generalModal && (
        <ExpenseModal open projects={projects} allowGeneral onClose={() => setGeneralModal(false)} onDone={() => { setGeneralModal(false); reload(); }} />
      )}
    </>
  );
}

export default function BudgetAdmin() {
  return (
    <RequireAuth permission={P.MANAGE_FINANCE}>
      <BudgetView />
    </RequireAuth>
  );
}
