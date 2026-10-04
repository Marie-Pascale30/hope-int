"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  CalendarDays, ChevronRight, ClipboardCheck, Clock, FileText, HandCoins, HeartHandshake, Inbox, MapPinned, Newspaper,
  ScrollText, Server, UserPlus, Users, Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { ErrorState, PageSkeleton, PageHeader, StatCard } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { useFormat } from "../../i18n/format";
import { adminApi } from "../../services";
import { can, PERMISSIONS as P } from "../../utils/rbac";
import { useErrorMessage } from "../../i18n/errors";
import { alignMonthly, lastMonths, monthLabel } from "./parts-a/months";

const chartFallback = () => <div className="chart-box skeleton" aria-hidden="true" />;
const DonationsChart = dynamic(() => import("./parts-a/OverviewCharts").then((mod) => mod.DonationsChart), {
  ssr: false,
  loading: chartFallback,
});
const MembersChart = dynamic(() => import("./parts-a/OverviewCharts").then((mod) => mod.MembersChart), {
  ssr: false,
  loading: chartFallback,
});

// label : cle des messages "admin.overview.shortcuts".
const SHORTCUTS = [
  { href: "/admin/membres", label: "createAccount", icon: UserPlus, permission: P.MANAGE_USER_ROLES },
  { href: "/admin/actualites", label: "publishNews", icon: Newspaper, permission: P.MANAGE_CONTENT },
  { href: "/admin/evenements", label: "scheduleEvent", icon: CalendarDays, permission: P.MANAGE_ORGANIZATION },
  { href: "/admin/dons", label: "viewDonations", icon: HandCoins, permission: P.VIEW_DONATIONS },
  { href: "/admin/finance", label: "exportAccounting", icon: Wallet, permission: P.MANAGE_FINANCE },
  { href: "/admin/rapport", label: "annualReport", icon: FileText, permission: P.VIEW_STATS },
  { href: "/admin/journal", label: "activityLog", icon: ScrollText, permission: P.VIEW_LOGS },
  { href: "/admin/systeme", label: "systemStatus", icon: Server, permission: P.MANAGE_IT },
];

function greeting(t, name) {
  const hour = new Date().getHours();
  const first = String(name || "").split(/\s+/)[0];
  const evening = hour >= 18 || hour < 5;
  if (!first) return t(evening ? "greetingEveningAnonymous" : "greetingDayAnonymous");
  return t(evening ? "greetingEvening" : "greetingDay", { name: first });
}

function TodoList({ stats, user }) {
  const t = useTranslations("admin.overview.todo");
  const items = [
    {
      permission: P.MANAGE_APPLICATIONS,
      count: stats.pendingApplications,
      href: "/admin/candidatures",
      icon: ClipboardCheck,
      label: t("applications", { count: stats.pendingApplications }),
      hint: t("applicationsHint"),
    },
    {
      permission: P.VIEW_MESSAGES,
      count: stats.unreadMessages,
      href: "/admin/messages",
      icon: Inbox,
      label: t("messages", { count: stats.unreadMessages }),
      hint: t("messagesHint"),
    },
    {
      permission: P.VIEW_DONATIONS,
      count: stats.pendingPayments,
      href: "/admin/dons",
      icon: Clock,
      label: t("payments", { count: stats.pendingPayments }),
      hint: t("paymentsHint"),
    },
  ].filter((item) => can(user, item.permission));

  const pending = items.filter((item) => item.count > 0);
  if (!items.length) return null;

  return (
    <section className="panel" aria-labelledby="adm-todo-title">
      <div className="panel__head">
        <div>
          <h2 className="panel__title" id="adm-todo-title">{t("title")}</h2>
          <p className="panel__desc">{t("description")}</p>
        </div>
      </div>
      {pending.length === 0 ? (
        <p className="adm-allclear">{t("allClear")}</p>
      ) : (
        <ul className="adm-todo">
          {pending.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href} className="adm-todo__link">
                  <span className="adm-todo__icon"><Icon size={18} aria-hidden="true" /></span>
                  <span className="adm-todo__text">
                    <strong>{item.label}</strong>
                    <span>{item.hint}</span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Shortcuts({ user }) {
  const t = useTranslations("admin.overview.shortcuts");
  const items = SHORTCUTS.filter((item) => can(user, item.permission));
  if (!items.length) return null;
  return (
    <section className="panel" aria-labelledby="adm-shortcuts-title">
      <div className="panel__head">
        <div>
          <h2 className="panel__title" id="adm-shortcuts-title">{t("title")}</h2>
          <p className="panel__desc">{t("description")}</p>
        </div>
      </div>
      <div className="adm-shortcuts">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href + item.label} href={item.href} className="adm-shortcut">
              <Icon size={18} aria-hidden="true" />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Dashboard() {
  const t = useTranslations("admin.overview");
  const f = useFormat();
  const errorText = useErrorMessage();
  const { user } = useAuth();
  const { data: stats, loading, error, reload } = useAsync(() => adminApi.stats(), []);

  const header = (
    <PageHeader
      eyebrow={t("eyebrow")}
      title={greeting(t, user?.name)}
      description={t("description")}
    />
  );

  if (loading) return <>{header}<PageSkeleton variant="dashboard" label={t("loading")} /></>;
  if (error) return <>{header}<ErrorState message={errorText(error)} onRetry={reload} /></>;

  const months = lastMonths();
  const labels = months.map((month) => monthLabel(f, month));
  const donations = alignMonthly(stats.monthlyDonations, "amount", months);
  const members = alignMonthly(stats.monthlyGrowth, "users", months);
  const donationsTotal = donations.reduce((sum, value) => sum + value, 0);
  const membersTotal = members.reduce((sum, value) => sum + value, 0);
  const lastLabel = monthLabel(f, months[months.length - 1]);

  return (
    <>
      {header}

      {/* Portee regionale (stats.region non nul) : indicateurs filtres sur la region de la fiche. */}
      {stats.region && (
        <div className="adm-scope" role="note">
          <MapPinned size={16} aria-hidden="true" />
          <span>
            <strong>{t("scopeRegion", { region: stats.region })}</strong>
            {" — "}
            {t("scopeRegionHint")}
          </span>
        </div>
      )}

      <div className="admin-grid-stats">
        <StatCard
          label={t("stats.donations")}
          value={f.money(stats.totalDonations)}
          hint={t("stats.donationsHint", { amount: f.money(stats.donationsLast30) })}
          icon={HandCoins}
          tone="accent"
        />
        <StatCard
          label={t("stats.donors")}
          value={f.number(stats.donorsCount)}
          hint={t("stats.donorsHint", { count: stats.donationsCount })}
          icon={HeartHandshake}
        />
        <StatCard
          label={t("stats.activeMembers")}
          value={f.number(stats.activeMembers)}
          hint={t("stats.activeMembersHint", { count: stats.newMembers30 })}
          icon={Users}
          tone="info"
        />
        <StatCard
          label={t("stats.pendingApplications")}
          value={f.number(stats.pendingApplications)}
          hint={t("stats.pendingApplicationsHint")}
          icon={ClipboardCheck}
          tone={stats.pendingApplications > 0 ? "warning" : undefined}
        />
        <StatCard
          label={t("stats.unreadMessages")}
          value={f.number(stats.unreadMessages)}
          hint={t("stats.unreadMessagesHint")}
          icon={Inbox}
          tone={stats.unreadMessages > 0 ? "warning" : undefined}
        />
        <StatCard
          label={t("stats.upcomingEvents")}
          value={f.number(stats.upcomingEvents)}
          hint={t("stats.upcomingEventsHint")}
          icon={CalendarDays}
        />
        <StatCard
          label={t("stats.pendingPayments")}
          value={f.number(stats.pendingPayments)}
          hint={t("stats.pendingPaymentsHint")}
          icon={Clock}
          tone={stats.pendingPayments > 0 ? "warning" : undefined}
        />
      </div>

      <div className="admin-panels">
        <section className="panel" aria-labelledby="adm-chart-dons">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-chart-dons">{t("donationsChart.title")}</h2>
              <p className="panel__desc">{t("donationsChart.description")}</p>
            </div>
          </div>
          <div className="adm-figures">
            <div><span>{t("total12")}</span><strong>{f.money(donationsTotal)}</strong></div>
            <div><span>{lastLabel}</span><strong>{f.money(donations[donations.length - 1])}</strong></div>
          </div>
          <DonationsChart labels={labels} values={donations} />
        </section>

        <section className="panel" aria-labelledby="adm-chart-membres">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-chart-membres">{t("membersChart.title")}</h2>
              <p className="panel__desc">{t("membersChart.description")}</p>
            </div>
          </div>
          <div className="adm-figures">
            <div><span>{t("total12")}</span><strong>{f.number(membersTotal)}</strong></div>
            <div><span>{lastLabel}</span><strong>{f.number(members[members.length - 1])}</strong></div>
          </div>
          <MembersChart labels={labels} values={members} />
        </section>
      </div>

      <div className="admin-panels">
        <TodoList stats={stats} user={user} />
        <Shortcuts user={user} />
      </div>
    </>
  );
}

export default function Overview() {
  return (
    <RequireAuth permission={P.VIEW_STATS}>
      <Dashboard />
    </RequireAuth>
  );
}
