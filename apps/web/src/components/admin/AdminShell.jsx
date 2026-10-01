"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, CalendarDays, ClipboardCheck, ExternalLink, FileText, HandCoins, Inbox, KeyRound, LayoutDashboard,
  LogOut, MapPinned, Menu, MessageSquareQuote, Newspaper, ScrollText, Server, Sprout, Users, Wallet, X,
} from "lucide-react";
import { LogoMark } from "../site/Logo";
import { Avatar } from "../ui";
import RequireAuth from "../RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { adminApi } from "../../services";
import { can, PERMISSIONS as P } from "../../utils/rbac";
import { roleLabel } from "../../utils/labels";

// Navigation de l'administration : chaque entree n'apparait qu'avec la permission requise.
export const ADMIN_NAV = [
  {
    title: "Pilotage",
    items: [
      { href: "/admin", label: "Vue d'ensemble", icon: LayoutDashboard, permission: P.VIEW_STATS, exact: true },
      { href: "/admin/rapport", label: "Rapport annuel", icon: FileText, permission: P.VIEW_STATS },
      { href: "/admin/region", label: "Ma région", icon: MapPinned, permission: P.MANAGE_REGIONAL },
    ],
  },
  {
    title: "Relations",
    items: [
      { href: "/admin/candidatures", label: "Candidatures", icon: ClipboardCheck, permission: P.MANAGE_APPLICATIONS, badge: "pendingApplications" },
      { href: "/admin/messages", label: "Messages", icon: Inbox, permission: P.VIEW_MESSAGES, badge: "unreadMessages" },
    ],
  },
  {
    title: "Équipe",
    items: [
      { href: "/admin/membres", label: "Membres", icon: Users, permission: P.VIEW_USERS },
      { href: "/admin/roles", label: "Rôles et droits", icon: KeyRound, permission: P.ACCESS_ADMIN_DASHBOARD },
    ],
  },
  {
    title: "Dons",
    items: [
      { href: "/admin/dons", label: "Dons", icon: HandCoins, permission: P.VIEW_DONATIONS },
      { href: "/admin/finance", label: "Finance", icon: Wallet, permission: P.MANAGE_FINANCE },
    ],
  },
  {
    title: "Contenus",
    items: [
      { href: "/admin/projets", label: "Projets et campagnes", icon: Sprout, permission: P.MANAGE_CONTENT },
      { href: "/admin/actualites", label: "Actualités", icon: Newspaper, permission: P.MANAGE_CONTENT },
      { href: "/admin/temoignages", label: "Témoignages", icon: MessageSquareQuote, permission: P.MANAGE_CONTENT },
      { href: "/admin/evenements", label: "Événements", icon: CalendarDays, permission: P.MANAGE_ORGANIZATION },
    ],
  },
  {
    title: "Système",
    items: [
      { href: "/admin/journal", label: "Journal d'activité", icon: ScrollText, permission: P.VIEW_LOGS },
      { href: "/admin/systeme", label: "État du système", icon: Server, permission: P.MANAGE_IT },
    ],
  },
];

function Sidebar({ user, counts, onNavigate, onLogout }) {
  const pathname = usePathname();
  const isActive = (item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="admin-sidebar__inner">
      <Link href="/admin" className="admin-brand" onClick={onNavigate}>
        <LogoMark size={32} />
        <span>
          HOPE
          <small>Administration</small>
        </span>
      </Link>

      <nav className="admin-nav" aria-label="Administration">
        {ADMIN_NAV.map((section) => {
          const items = section.items.filter((item) => can(user, item.permission));
          if (!items.length) return null;
          return (
            <div key={section.title} className="admin-nav__section">
              <span className="admin-nav__title">{section.title}</span>
              {items.map((item) => {
                const Icon = item.icon;
                const count = item.badge ? counts?.[item.badge] : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-nav__link${isActive(item) ? " is-active" : ""}`}
                    aria-current={isActive(item) ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                    {count > 0 && <span className="admin-nav__badge">{count}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="admin-sidebar__foot">
        <div className="admin-user">
          <Avatar name={user.name} />
          <div>
            <strong>{user.name}</strong>
            <span>{roleLabel(user.roles?.[0])}{user.roles?.length > 1 ? ` +${user.roles.length - 1}` : ""}</span>
          </div>
        </div>
        <div className="admin-sidebar__links">
          <Link href="/" onClick={onNavigate}><ExternalLink size={16} aria-hidden="true" /> Voir le site</Link>
          <Link href="/espace" onClick={onNavigate}><BarChart3 size={16} aria-hidden="true" /> Mon espace</Link>
          <button type="button" onClick={onLogout}><LogOut size={16} aria-hidden="true" /> Déconnexion</button>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [counts, setCounts] = useState(null);

  // Compteurs "a traiter" (candidatures, messages) rafraichis a chaque navigation.
  useEffect(() => {
    if (!can(user, P.VIEW_STATS)) return;
    adminApi.stats().then(setCounts).catch(() => {});
  }, [user, pathname]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar${drawerOpen ? " is-open" : ""}`}>
        <Sidebar user={user} counts={counts} onNavigate={() => setDrawerOpen(false)} onLogout={logout} />
      </aside>
      {drawerOpen && <div className="admin-overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="admin-topbar__burger" aria-label="Ouvrir le menu" onClick={() => setDrawerOpen(true)}>
            {drawerOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <span className="admin-topbar__title">HOPE Administration</span>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

export default function AdminShell({ children }) {
  return (
    <RequireAuth permission={P.ACCESS_ADMIN_DASHBOARD}>
      <Shell>{children}</Shell>
    </RequireAuth>
  );
}
