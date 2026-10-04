"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Logo from "./Logo";
import LocaleSwitcher from "./LocaleSwitcher";
import { Button, Avatar } from "../ui";
import { useAuth } from "../../context/AuthContext";
import { Link, useLocalePath, usePathname } from "../../i18n/navigation";
import { isStaff } from "../../utils/rbac";

const NAV = [
  { href: "/projets", key: "projects" },
  { href: "/actualites", key: "news" },
  { href: "/evenements", key: "events" },
  { href: "/rejoindre", key: "join" },
  { href: "/contact", key: "contact" },
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
            <UserRound size={17} aria-hidden="true" /> {t("account")}
          </Link>
          {isStaff(user) && (
            // Back-office sans prefixe de langue (langue lue dans le cookie) : lien hors next-intl.
            <a href="/admin" role="menuitem" onClick={() => setOpen(false)}>
              <LayoutDashboard size={17} aria-hidden="true" /> {t("admin")}
            </a>
          )}
          <button type="button" role="menuitem" onClick={onLogout}>
            <LogOut size={17} aria-hidden="true" /> {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const { user, status, logout } = useAuth();
  const t = useTranslations("nav");
  const lp = useLocalePath();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const burgerRef = useRef(null);
  const navRef = useRef(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const closeMenu = useCallback(({ restoreFocus = true } = {}) => {
    setMobileOpen(false);
    if (restoreFocus) burgerRef.current?.focus();
  }, []);

  // Menu mobile ouvert : Echap ferme, la page ne defile plus, le focus va au premier lien.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const root = document.documentElement;
    root.classList.add("has-mobile-nav");
    navRef.current?.querySelector("a")?.focus();
    const onKey = (event) => event.key === "Escape" && closeMenu();
    // Retour en affichage bureau : le menu se referme.
    const media = window.matchMedia("(min-width: 961px)");
    const onMedia = () => media.matches && closeMenu({ restoreFocus: false });
    document.addEventListener("keydown", onKey);
    media.addEventListener("change", onMedia);
    return () => {
      root.classList.remove("has-mobile-nav");
      document.removeEventListener("keydown", onKey);
      media.removeEventListener("change", onMedia);
    };
  }, [mobileOpen, closeMenu]);

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
        <Logo href={lp("/")} label={t("home")} />

        <nav id="site-nav" ref={navRef} className={`site-nav${mobileOpen ? " is-open" : ""}`} aria-label={t("main")}>
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
                <Button href={lp("/espace")} variant="secondary" block icon={UserRound}>{t("account")}</Button>
                {isStaff(user) && <Button href="/admin" variant="secondary" block icon={LayoutDashboard}>{t("admin")}</Button>}
                <Button variant="ghost" block icon={LogOut} onClick={logout}>{t("logout")}</Button>
              </>
            ) : (
              <Button href={lp("/connexion")} variant="secondary" block>{t("login")}</Button>
            )}
            <LocaleSwitcher className="site-nav__locale" />
          </div>
        </nav>

        <div className="site-header__actions">
          <LocaleSwitcher variant="menu" className="site-header__locale" />
          <Button href={lp("/don")} variant="accent" size="sm" icon={Heart} className="site-header__donate">
            <span className="site-header__donate-long">{t("donate")}</span>
            <span className="site-header__donate-short" aria-hidden="true">{t("donateShort")}</span>
          </Button>
          <div className="site-header__account">
            {status === "authenticated" && user ? (
              <UserMenu user={user} onLogout={logout} t={t} />
            ) : status === "anonymous" ? (
              <Link href="/connexion" className="site-header__login">{t("login")}</Link>
            ) : null}
          </div>
          <button
            type="button"
            ref={burgerRef}
            className="site-header__burger"
            aria-label={mobileOpen ? t("menuClose") : t("menuOpen")}
            aria-expanded={mobileOpen}
            aria-controls="site-nav"
            onClick={() => (mobileOpen ? closeMenu() : setMobileOpen(true))}
          >
            {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
