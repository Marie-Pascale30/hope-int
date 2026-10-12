// Page publique "Transparence" (composant serveur) : chiffres d'une annee publiee par la
// direction. Agregats uniquement : recettes nettes (par moyen de paiement et par projet),
// depenses (par categorie et par projet), impact et rapports annuels en PDF.
import "@/src/styles/public.css";
import "@/src/styles/transparency.css";
import { CheckCircle2, Download, FileText, HandCoins, Receipt, Scale, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, StatCard } from "@/src/components/ui";
import { EmptyIllustration } from "@/src/components/illustrations";
import { useFormat } from "@/src/i18n/format";
import { Link, useLocalePath } from "@/src/i18n/navigation";
import { resolveImage } from "@/src/utils/format";
import { PublicHero } from "@/src/views/site/components";
import LoadError from "@/src/views/site/components/LoadError";
import { shareRows } from "./helpers";

const euros = (f, value) => f.money(Math.round(Number(value) || 0), "eur");

// Tableau accessible + barres horizontales decoratives (masquees en mode eco donnees).
function ShareList({ rows, caption, labelHeader, valueHeader }) {
  const f = useFormat();
  const t = useTranslations("transparency.public");
  if (!rows.length) return <p className="muted">{t("noData")}</p>;
  return (
    <table className="tp-share">
      <caption className="visually-hidden">{caption}</caption>
      <thead className="visually-hidden">
        <tr>
          <th scope="col">{labelHeader}</th>
          <th scope="col">{valueHeader}</th>
          <th scope="col">{t("share")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">
              <span className="tp-share__label">{row.label}</span>
              <span className="tp-bar" aria-hidden="true"><span style={{ width: `${row.percent}%` }} /></span>
            </th>
            <td className="tp-share__value">{euros(f, row.value)}</td>
            <td className="tp-share__pct">{f.number(row.percent, { maximumFractionDigits: 1 })} %</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function YearNav({ years, current }) {
  const t = useTranslations("transparency.public");
  if (!years?.length) return null;
  return (
    <nav className="tp-years" aria-label={t("yearsLabel")}>
      {years.map((year) => (
        <Link
          key={year}
          href={`/transparence/${year}`}
          className={`tp-years__item${year === current ? " is-active" : ""}`}
          aria-current={year === current ? "page" : undefined}
        >
          {year}
        </Link>
      ))}
    </nav>
  );
}

function Documents({ documents }) {
  const t = useTranslations("transparency.public.documents");
  const tKinds = useTranslations("transparency.documentKinds");
  const f = useFormat();
  if (!documents?.length) return <p className="muted">{t("empty")}</p>;
  return (
    <ul className="tp-docs">
      {documents.map((doc) => (
        <li key={doc.id}>
          <FileText aria-hidden="true" />
          <div>
            <strong>{doc.title}</strong>
            <span className="muted">
              {tKinds(doc.kind in { annual_report: 1, financial_statements: 1, audit: 1 } ? doc.kind : "other")} · {doc.year}
              {doc.file_size ? ` · ${t("size", { size: f.number(doc.file_size / 1024 / 1024, { maximumFractionDigits: 1 }) })}` : ""}
            </span>
          </div>
          <Button href={resolveImage(doc.file_url)} variant="secondary" size="sm" icon={Download} aria-label={t("downloadNamed", { title: doc.title })}>
            {t("download")}
          </Button>
        </li>
      ))}
    </ul>
  );
}

// Aucune annee publiee : etat vide illustre (et documents s'il y en a).
export function TransparencyEmpty({ index, error }) {
  const t = useTranslations("transparency.public");
  const lp = useLocalePath();
  return (
    <>
      <PublicHero eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <section className="section section--tight">
        <div className="container">
          {error ? (
            <LoadError />
          ) : (
            <div className="tp-empty">
              <EmptyIllustration />
              <h2>{t("empty.title")}</h2>
              <p>{t("empty.text")}</p>
              <Button href={lp("/projets")} variant="secondary">{t("empty.cta")}</Button>
            </div>
          )}
          {index?.documents?.length > 0 && (
            <div className="pub-block">
              <h2>{t("documents.title")}</h2>
              <Documents documents={index.documents} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default function TransparencyView({ data }) {
  const t = useTranslations("transparency.public");
  const tCat = useTranslations("transparency.categories");
  const tMethod = useTranslations("transparency.methods");
  const f = useFormat();
  const lp = useLocalePath();
  const { revenue, expenses, impact } = data;

  const projectLabel = (row) => (row.projectId === null ? t("generalFund") : row.projectId === 0 ? t("otherProjects") : row.title);
  const methodRows = shareRows(revenue.byMethod, (row) => row.method, (row) => tMethod(["card", "mobile_money"].includes(row.method) ? row.method : "other"));
  const revenueProjects = shareRows(revenue.byProject, (row) => String(row.projectId), projectLabel);
  const categoryRows = shareRows(expenses.byCategory, (row) => row.category, (row) => tCat(row.category));
  const hasExpenses = expenses.totalEur > 0;

  return (
    <>
      <PublicHero eyebrow={t("eyebrow")} title={t("yearTitle", { year: data.year })} lead={t("lead")}>
        <YearNav years={data.years} current={data.year} />
      </PublicHero>

      <section className="section section--tight" aria-labelledby="tp-key-title">
        <div className="container">
          <div className="tp-validated">
            <CheckCircle2 aria-hidden="true" />
            <div>
              <p>{data.publishedAt ? t("publishedOn", { date: f.date(data.publishedAt) }) : t("published")}</p>
              {data.note && <p className="tp-validated__note">{data.note}</p>}
            </div>
          </div>
          <h2 id="tp-key-title" className="visually-hidden">{t("keyTitle")}</h2>
          <div className="tp-kpis">
            <StatCard label={t("kpi.revenue")} value={euros(f, revenue.totalEur)} hint={t("kpi.revenueHint", { count: revenue.count })} icon={HandCoins} />
            <StatCard label={t("kpi.expenses")} value={hasExpenses ? euros(f, expenses.totalEur) : t("kpi.notEntered")} icon={Receipt} tone="accent" />
            <StatCard label={t("kpi.balance")} value={hasExpenses ? euros(f, data.balanceEur) : "—"} hint={t("kpi.balanceHint")} icon={Scale} tone="info" />
            <StatCard label={t("kpi.beneficiaries")} value={f.number(impact.beneficiaries)} hint={t("kpi.beneficiariesHint")} icon={Users} />
          </div>
        </div>
      </section>

      <section className="section section--alt" aria-labelledby="tp-revenue-title">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t("revenue.eyebrow")}</span>
            <h2 id="tp-revenue-title">{t("revenue.title")}</h2>
            <p>{t("revenue.text")}</p>
          </div>
          <div className="tp-grid">
            <div className="tp-panel">
              <h3>{t("revenue.byMethod")}</h3>
              <ShareList rows={methodRows} caption={t("revenue.byMethod")} labelHeader={t("revenue.method")} valueHeader={t("amount")} />
            </div>
            <div className="tp-panel">
              <h3>{t("revenue.byProject")}</h3>
              <ShareList rows={revenueProjects} caption={t("revenue.byProject")} labelHeader={t("project")} valueHeader={t("amount")} />
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="tp-expenses-title">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t("expenses.eyebrow")}</span>
            <h2 id="tp-expenses-title">{t("expenses.title")}</h2>
            <p>{t("expenses.text")}</p>
          </div>
          {!hasExpenses ? (
            <p className="tp-panel muted">{t("expenses.empty")}</p>
          ) : (
            <div className="tp-grid">
              <div className="tp-panel">
                <h3>{t("expenses.byCategory")}</h3>
                <ShareList rows={categoryRows} caption={t("expenses.byCategory")} labelHeader={t("expenses.category")} valueHeader={t("amount")} />
              </div>
              <div className="tp-panel">
                <h3>{t("expenses.byProject")}</h3>
                <div className="tp-table-wrap">
                  <table className="tp-table">
                    <caption className="visually-hidden">{t("expenses.byProject")}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t("project")}</th>
                        <th scope="col">{t("expenses.spent")}</th>
                        <th scope="col">{t("expenses.planned")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.byProject.map((row) => (
                        <tr key={String(row.projectId)}>
                          <th scope="row">
                            {row.projectId ? <Link href={`/projets/${row.projectId}`}>{row.title}</Link> : projectLabel(row)}
                          </th>
                          <td>{euros(f, row.amountEur)}</td>
                          <td>{row.plannedEur ? euros(f, row.plannedEur) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="tp-footnote">{t("expenses.plannedNote")}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section section--alt" aria-labelledby="tp-impact-title">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t("impact.eyebrow")}</span>
            <h2 id="tp-impact-title">{t("impact.title")}</h2>
            <p>{t("impact.scope")}</p>
          </div>
          <dl className="tp-impact">
            {[
              ["projects", impact.projects],
              ["beneficiaries", impact.beneficiaries],
              ["trainees", impact.trainees],
              ["credits", impact.creditsGranted],
              ["regions", impact.regionsCovered],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{t(`impact.${key}`)}</dt>
                <dd>{f.number(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="section" aria-labelledby="tp-docs-title">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t("documents.eyebrow")}</span>
            <h2 id="tp-docs-title">{t("documents.title")}</h2>
          </div>
          <Documents documents={data.documents} />
          <div className="tp-method">
            <h3>{t("method.title")}</h3>
            <ul>
              <li>{t("method.net")}</li>
              <li>{t("method.privacy")}</li>
              <li>{t("method.rate")}</li>
              <li>{t("method.impact")}</li>
            </ul>
            <Button href={lp("/contact")} variant="secondary">{t("method.question")}</Button>
          </div>
        </div>
      </section>
    </>
  );
}
