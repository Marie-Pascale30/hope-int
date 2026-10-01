"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
import Logo from "./Logo";
import { Button, Avatar } from "../ui";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../i18n";
import { isStaff } from "../../utils/rbac";

const NAV = [
  { href: "/projets", key: "nav.projects" },
  { href: "/actualites", key: "nav.news" },
  { href: "/evenements", key: "nav.events" },
  { href: "/rejoindre", key: "nav.join" },
  { href: "/contact", key: "nav.contact" },
];

function UserMenu({ user, onLogout, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => !ref.current?.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={user.name} />
        <span className="user-menu__name">{user.name.split(" ")[0]}</span>
      </button>
      {open && (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__head">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <Link href="/espace" role="menuitem" onClick={() => setOpen(false)}>
            <UserRound size={17} aria-hidden="true" /> {t("nav.account")}
          </Link>
          {isStaff(user) && (
            <Link href="/admin" role="menuitem" onClick={() => setOpen(false)}>
              <LayoutDashboard size={17} aria-hidden="true" /> {t("nav.admin")}
            </Link>
          )}
          <button type="button" role="menuitem" onClick={onLogout}>
            <LogOut size={17} aria-hidden="true" /> {t("nav.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const { user, status, logout } = useAuth();
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="container site-header__inner">
        <Logo />

        <nav className={`site-nav${mobileOpen ? " is-open" : ""}`} aria-label="Navigation principale">
          <ul>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={isActive(item.href) ? "is-active" : undefined} aria-current={isActive(item.href) ? "page" : undefined}>
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="site-nav__mobile-actions">
            {status === "authenticated" ? (
              <>
                <Button href="/espace" variant="secondary" block icon={UserRound}>{t("nav.account")}</Button>
                {isStaff(user) && <Button href="/admin" variant="secondary" block icon={LayoutDashboard}>{t("nav.admin")}</Button>}
                <Button variant="ghost" block icon={LogOut} onClick={logout}>{t("nav.logout")}</Button>
              </>
            ) : (
              <Button href="/connexion" variant="secondary" block>{t("nav.login")}</Button>
            )}
          </div>
        </nav>

        <div className="site-header__actions">
          <Button href="/don" variant="accent" size="sm" icon={Heart} className="site-header__donate">
            {t("nav.donate")}
          </Button>
          <div className="site-header__account">
            {status === "authenticated" && user ? (
              <UserMenu user={user} onLogout={logout} t={t} />
            ) : status === "anonymous" ? (
              <Link href="/connexion" className="site-header__login">{t("nav.login")}</Link>
            ) : null}
          </div>
          <button
            type="button"
            className="site-header__burger"
            aria-label={t("nav.menu")}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
