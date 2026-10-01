"use client";

import "../../styles/admin-a.css";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  CalendarDays, ChevronRight, ClipboardCheck, Clock, FileText, HandCoins, HeartHandshake, Inbox, Newspaper,
  ScrollText, Server, UserPlus, Users, Wallet,
} from "lucide-react";
import { ErrorState, LoadingState, PageHeader, StatCard } from "../../components/ui";
import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import { adminApi } from "../../services";
import { getErrorMessage } from "../../services/api";
import { formatMoney, formatMonth, formatNumber } from "../../utils/format";
import { can, PERMISSIONS as P } from "../../utils/rbac";
import { alignMonthly, lastMonths } from "./parts-a/months";

const chartFallback = () => <div className="chart-box skeleton" aria-hidden="true" />;
const DonationsChart = dynamic(() => import("./parts-a/OverviewCharts").then((mod) => mod.DonationsChart), {
  ssr: false,
  loading: chartFallback,
});
const MembersChart = dynamic(() => import("./parts-a/OverviewCharts").then((mod) => mod.MembersChart), {
  ssr: false,
  loading: chartFallback,
});

const SHORTCUTS = [
  { href: "/admin/membres", label: "Créer un compte", icon: UserPlus, permission: P.MANAGE_USER_ROLES },
  { href: "/admin/actualites", label: "Publier une actualité", icon: Newspaper, permission: P.MANAGE_CONTENT },
  { href: "/admin/evenements", label: "Programmer un événement", icon: CalendarDays, permission: P.MANAGE_ORGANIZATION },
  { href: "/admin/dons", label: "Consulter les dons", icon: HandCoins, permission: P.VIEW_DONATIONS },
  { href: "/admin/finance", label: "Exporter la comptabilité", icon: Wallet, permission: P.MANAGE_FINANCE },
  { href: "/admin/rapport", label: "Rapport annuel", icon: FileText, permission: P.VIEW_STATS },
  { href: "/admin/journal", label: "Journal d'activité", icon: ScrollText, permission: P.VIEW_LOGS },
  { href: "/admin/systeme", label: "État du système", icon: Server, permission: P.MANAGE_IT },
];

function greeting(name) {
  const hour = new Date().getHours();
  const first = String(name || "").split(/\s+/)[0];
  return `${hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour"}${first ? ` ${first}` : ""}`;
}

const plural = (count, singular, pluralForm) => `${formatNumber(count)} ${count > 1 ? pluralForm : singular}`;

function TodoList({ stats, user }) {
  const items = [
    {
      permission: P.MANAGE_APPLICATIONS,
      count: stats.pendingApplications,
      href: "/admin/candidatures",
      icon: ClipboardCheck,
      label: plural(stats.pendingApplications, "candidature à traiter", "candidatures à traiter"),
      hint: "Nouvelles ou en cours d'étude",
    },
    {
      permission: P.VIEW_MESSAGES,
      count: stats.unreadMessages,
      href: "/admin/messages",
      icon: Inbox,
      label: plural(stats.unreadMessages, "message non lu", "messages non lus"),
      hint: "Reçus via le formulaire de contact",
    },
    {
      permission: P.VIEW_DONATIONS,
      count: stats.pendingPayments,
      href: "/admin/dons",
      icon: Clock,
      label: plural(stats.pendingPayments, "paiement en attente", "paiements en attente"),
      hint: "À vérifier ou rapprocher avec le prestataire",
    },
  ].filter((item) => can(user, item.permission));

  const pending = items.filter((item) => item.count > 0);
  if (!items.length) return null;

  return (
    <section className="panel" aria-labelledby="adm-todo-title">
      <div className="panel__head">
        <div>
          <h2 className="panel__title" id="adm-todo-title">À traiter</h2>
          <p className="panel__desc">Les demandes qui attendent une réponse de l&apos;équipe.</p>
        </div>
      </div>
      {pending.length === 0 ? (
        <p className="adm-allclear">Tout est à jour : aucune demande en attente. Merci pour votre réactivité !</p>
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
  const items = SHORTCUTS.filter((item) => can(user, item.permission));
  if (!items.length) return null;
  return (
    <section className="panel" aria-labelledby="adm-shortcuts-title">
      <div className="panel__head">
        <div>
          <h2 className="panel__title" id="adm-shortcuts-title">Raccourcis</h2>
          <p className="panel__desc">Les actions courantes accessibles avec vos droits.</p>
        </div>
      </div>
      <div className="adm-shortcuts">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href + item.label} href={item.href} className="adm-shortcut">
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { data: stats, loading, error, reload } = useAsync(() => adminApi.stats(), []);

  const header = (
    <PageHeader
      eyebrow="Vue d'ensemble"
      title={greeting(user?.name)}
      description="Voici où en est HOPE International aujourd'hui : dons, communauté et demandes à traiter."
    />
  );

  if (loading) return <>{header}<LoadingState label="Chargement des indicateurs…" /></>;
  if (error) return <>{header}<ErrorState message={getErrorMessage(error)} onRetry={reload} /></>;

  const months = lastMonths();
  const labels = months.map(formatMonth);
  const donations = alignMonthly(stats.monthlyDonations, "amount", months);
  const members = alignMonthly(stats.monthlyGrowth, "users", months);
  const donationsTotal = donations.reduce((sum, value) => sum + value, 0);
  const membersTotal = members.reduce((sum, value) => sum + value, 0);
  const lastLabel = formatMonth(months[months.length - 1]);

  return (
    <>
      {header}

      <div className="admin-grid-stats">
        <StatCard
          label="Dons collectés"
          value={formatMoney(stats.totalDonations)}
          hint={`${formatMoney(stats.donationsLast30)} ces 30 derniers jours`}
          icon={HandCoins}
          tone="accent"
        />
        <StatCard
          label="Donateurs"
          value={formatNumber(stats.donorsCount)}
          hint={plural(stats.donationsCount, "don confirmé", "dons confirmés")}
          icon={HeartHandshake}
        />
        <StatCard
          label="Membres actifs"
          value={formatNumber(stats.activeMembers)}
          hint={`+${formatNumber(stats.newMembers30)} en 30 jours`}
          icon={Users}
          tone="info"
        />
        <StatCard
          label="Candidatures à traiter"
          value={formatNumber(stats.pendingApplications)}
          hint="Nouvelles ou en étude"
          icon={ClipboardCheck}
          tone={stats.pendingApplications > 0 ? "warning" : undefined}
        />
        <StatCard
          label="Messages non lus"
          value={formatNumber(stats.unreadMessages)}
          hint="Formulaire de contact"
          icon={Inbox}
          tone={stats.unreadMessages > 0 ? "warning" : undefined}
        />
        <StatCard label="Événements à venir" value={formatNumber(stats.upcomingEvents)} hint="Publiés sur le site" icon={CalendarDays} />
        <StatCard
          label="Paiements en attente"
          value={formatNumber(stats.pendingPayments)}
          hint="Non confirmés par le prestataire"
          icon={Clock}
          tone={stats.pendingPayments > 0 ? "warning" : undefined}
        />
      </div>

      <div className="admin-panels">
        <section className="panel" aria-labelledby="adm-chart-dons">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-chart-dons">Dons mensuels (12 mois, EUR)</h2>
              <p className="panel__desc">Dons confirmés, toutes devises converties en euros.</p>
            </div>
          </div>
          <div className="adm-figures">
            <div><span>Total sur 12 mois</span><strong>{formatMoney(donationsTotal)}</strong></div>
            <div><span>{lastLabel}</span><strong>{formatMoney(donations[donations.length - 1])}</strong></div>
          </div>
          <DonationsChart labels={labels} values={donations} />
        </section>

        <section className="panel" aria-labelledby="adm-chart-membres">
          <div className="panel__head">
            <div>
              <h2 className="panel__title" id="adm-chart-membres">Nouveaux membres par mois</h2>
              <p className="panel__desc">Comptes créés sur la plateforme (inscriptions et candidatures acceptées).</p>
            </div>
          </div>
          <div className="adm-figures">
            <div><span>Total sur 12 mois</span><strong>{formatNumber(membersTotal)}</strong></div>
            <div><span>{lastLabel}</span><strong>{formatNumber(members[members.length - 1])}</strong></div>
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
