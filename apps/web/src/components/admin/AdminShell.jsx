"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BarChart3, CalendarDays, ClipboardCheck, ExternalLink, FileText, HandCoins, Inbox, KeyRound, LayoutDashboard,
  LogOut, MapPinned, Menu, MessageSquareQuote, Newspaper, ScrollText, Server, Sprout, Users, Wallet, X,
} from "lucide-react";
import { LogoMark } from "../site/Logo";
import { Avatar } from "../ui";
import ThemeSwitcher from "../ThemeSwitcher";
import RequireAuth from "../RequireAuth";
import { useAuth } from "../../context/AuthContext";
import { adminApi } from "../../services";
import { can, PERMISSIONS as P } from "../../utils/rbac";
import { useLabels } from "../../utils/labels";

// Navigation de l'administration : chaque entree n'apparait qu'avec la permission requise.
// title / label : cles des messages "admin.nav" (sections : "admin.nav.sections").
export const ADMIN_NAV = [
  {
    title: "steering",
    items: [
      { href: "/admin", label: "overview", icon: LayoutDashboard, permission: P.VIEW_STATS, exact: true },
      { href: "/admin/rapport", label: "report", icon: FileText, permission: P.VIEW_STATS },
      { href: "/admin/region", label: "region", icon: MapPinned, permission: P.MANAGE_REGIONAL },
    ],
  },
  {
    title: "relations",
    items: [
      { href: "/admin/candidatures", label: "applications", icon: ClipboardCheck, permission: P.MANAGE_APPLICATIONS, badge: "pendingApplications" },
      { href: "/admin/messages", label: "messages", icon: Inbox, permission: P.VIEW_MESSAGES, badge: "unreadMessages" },
    ],
  },
  {
    title: "team",
    items: [
      { href: "/admin/membres", label: "members", icon: Users, permission: P.VIEW_USERS },
      { href: "/admin/roles", label: "roles", icon: KeyRound, permission: P.ACCESS_ADMIN_DASHBOARD },
    ],
  },
  {
    title: "donations",
    items: [
      { href: "/admin/dons", label: "donations", icon: HandCoins, permission: P.VIEW_DONATIONS },
      { href: "/admin/finance", label: "finance", icon: Wallet, permission: P.MANAGE_FINANCE },
    ],
  },
  {
    title: "content",
    items: [
      { href: "/admin/projets", label: "projects", icon: Sprout, permission: P.MANAGE_CONTENT },
      { href: "/admin/actualites", label: "news", icon: Newspaper, permission: P.MANAGE_CONTENT },
      { href: "/admin/temoignages", label: "testimonials", icon: MessageSquareQuote, permission: P.MANAGE_CONTENT },
      { href: "/admin/evenements", label: "events", icon: CalendarDays, permission: P.MANAGE_ORGANIZATION },
    ],
  },
  {
    title: "system",
    items: [
      { href: "/admin/journal", label: "logs", icon: ScrollText, permission: P.VIEW_LOGS },
      { href: "/admin/systeme", label: "system", icon: Server, permission: P.MANAGE_IT },
    ],
  },
];

// Tiroir de navigation sous 960 px (meme valeur que admin.css).
const DRAWER_QUERY = "(max-width: 960px)";

function useIsDrawer() {
  const [isDrawer, setIsDrawer] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(DRAWER_QUERY);
    const sync = () => setIsDrawer(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return isDrawer;
}

function Sidebar({ user, counts, onNavigate, onLogout, onClose }) {
  const t = useTranslations("admin.shell");
  const tNav = useTranslations("admin.nav");
  const labels = useLabels();
  const pathname = usePathname();
  const isActive = (item) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="admin-sidebar__inner">
      <div className="admin-sidebar__head">
        <Link href="/admin" className="admin-brand" onClick={onNavigate}>
          <LogoMark size={32} />
          <span>
            HOPE
            <small>{t("brand")}</small>
          </span>
        </Link>
        <button type="button" className="admin-sidebar__close" onClick={onClose} aria-label={t("closeMenu")}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <nav className="admin-nav" aria-label={t("navLabel")}>
        {ADMIN_NAV.map((section) => {
          const items = section.items.filter((item) => can(user, item.permission));
          if (!items.length) return null;
          return (
            <div key={section.title} className="admin-nav__section">
              <span className="admin-nav__title">{tNav(`sections.${section.title}`)}</span>
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
                    <span>{tNav(item.label)}</span>
                    {count > 0 && (
                      <span className="admin-nav__badge">
                        <span aria-hidden="true">{count}</span>
                        <span className="visually-hidden">{t("pendingBadge", { count })}</span>
                      </span>
                    )}
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
            <span>{labels.role(user.roles?.[0])}{user.roles?.length > 1 ? ` ${t("moreRoles", { count: user.roles.length - 1 })}` : ""}</span>
          </div>
        </div>
        <div className="admin-sidebar__links">
          <Link href="/" onClick={onNavigate}><ExternalLink size={16} aria-hidden="true" /> {t("viewSite")}</Link>
          <Link href="/espace" onClick={onNavigate}><BarChart3 size={16} aria-hidden="true" /> {t("mySpace")}</Link>
          <button type="button" onClick={onLogout}><LogOut size={16} aria-hidden="true" /> {t("logout")}</button>
        </div>
        <div className="admin-sidebar__theme">
          <ThemeSwitcher onDark compact />
        </div>
      </div>
    </div>
  );
}

function Shell({ children }) {
  const t = useTranslations("admin.shell");
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isDrawer = useIsDrawer();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [counts, setCounts] = useState(null);
  const burgerRef = useRef(null);
  const sidebarRef = useRef(null);

  // Compteurs "a traiter" (candidatures, messages) rafraichis a chaque navigation.
  useEffect(() => {
    if (!can(user, P.VIEW_STATS)) return;
    adminApi.stats().then(setCounts).catch(() => {});
  }, [user, pathname]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Fermeture du tiroir : le focus revient au bouton qui l'a ouvert
  // (apres le rendu, une fois le contenu principal sorti de l'etat inert).
  const restoreFocus = useRef(false);
  const closeDrawer = useCallback(() => {
    restoreFocus.current = true;
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (drawerOpen || !restoreFocus.current) return;
    restoreFocus.current = false;
    burgerRef.current?.focus();
  }, [drawerOpen]);

  const drawerVisible = isDrawer && drawerOpen;

  // Tiroir ouvert : focus sur le premier lien, Echap pour fermer.
  useEffect(() => {
    if (!drawerVisible) return undefined;
    sidebarRef.current?.querySelector("a, button")?.focus();
    const onKey = (event) => event.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerVisible, closeDrawer]);

  return (
    <div className="admin-layout">
      <a href="#admin-contenu" className="skip-link">{t("skipLink")}</a>
      <aside
        id="admin-sidebar"
        ref={sidebarRef}
        className={`admin-sidebar${drawerOpen ? " is-open" : ""}`}
        aria-label={t("sidebarLabel")}
        inert={isDrawer && !drawerOpen ? true : undefined}
      >
        <Sidebar user={user} counts={counts} onNavigate={() => setDrawerOpen(false)} onLogout={logout} onClose={closeDrawer} />
      </aside>
      {drawerVisible && <div className="admin-overlay" onClick={closeDrawer} aria-hidden="true" />}

      {/* Tiroir ouvert : le reste de la page sort de l'ordre de tabulation (piege de focus). */}
      <div className="admin-main" inert={drawerVisible ? true : undefined}>
        <header className="admin-topbar">
          <button
            ref={burgerRef}
            type="button"
            className="admin-topbar__burger"
            aria-label={drawerOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={drawerOpen}
            aria-controls="admin-sidebar"
            onClick={() => setDrawerOpen((value) => !value)}
          >
            {drawerOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <span className="admin-topbar__title">{t("topbarTitle")}</span>
          <ThemeSwitcher compact />
        </header>
        <main id="admin-contenu" className="admin-content" tabIndex={-1}>{children}</main>
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
