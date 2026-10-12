"use client";

// Onglet "Projets que je soutiens" de l'espace membre : projets, progression de la collecte et
// dernieres actualites (GET /engagement/me/supported-projects).
import "./engagement.css";
import { HeartHandshake } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Card, EmptyState, ErrorState, LoadingState, ProgressBar } from "../../components/ui";
import { useAsync } from "../../hooks/useAsync";
import { useErrorMessage } from "../../i18n/errors";
import { useFormat } from "../../i18n/format";
import { Link, useLocalePath } from "../../i18n/navigation";
import { memberEngagementApi } from "../../services/engagement";

export default function SupportedProjectsTab() {
  const t = useTranslations("engagement.supported");
  const f = useFormat();
  const lp = useLocalePath();
  const errorText = useErrorMessage();
  const { data, loading, error, reload } = useAsync(() => memberEngagementApi.supportedProjects(), []);

  if (loading && !data) return <LoadingState label={t("title")} />;
  if (error) return <ErrorState title={t("loadError")} message={errorText(error)} onRetry={reload} />;
  if (!data?.length) {
    return (
      <EmptyState
        icon={HeartHandshake}
        title={t("title")}
        description={t("empty")}
        action={<Button href={lp("/projets")}>{t("emptyAction")}</Button>}
      />
    );
  }

  return (
    <div className="acc-tab stack">
      <h2 className="acc-section-title">{t("title")}</h2>
      <div className="eng-projects">
        {data.map((project) => (
          <Card key={project.id} className="stack">
            <h3>{project.title}</h3>
            {project.summary && <p className="muted acc-small">{project.summary}</p>}
            <p className="acc-small">{t("myGift", { amount: f.money(project.my_total_eur, "eur"), count: project.my_donations })}</p>
            {project.goal_eur ? (
              <>
                <ProgressBar value={project.progress} label={t("progress")} />
                <p className="muted acc-small">{t("raised", { raised: f.money(project.raised_eur, "eur"), goal: f.money(project.goal_eur, "eur") })}</p>
              </>
            ) : (
              <p className="muted acc-small">{t("raisedNoGoal", { raised: f.money(project.raised_eur, "eur") })}</p>
            )}
            <div>
              <strong className="acc-small">{t("latestNews")}</strong>
              {project.news.length ? (
                <ul className="eng-project__news">
                  {project.news.map((item) => (
                    <li key={item.id}>
                      <Link href={`/actualites/${item.id}`}>{item.title}</Link> <span className="muted">· {f.date(item.created_at)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted acc-small">{t("noNews")}</p>
              )}
            </div>
            <Link href={`/projets/${project.id}`}>{t("seeProject")} →</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
