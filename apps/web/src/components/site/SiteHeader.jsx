"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Logo from "./Logo";
import LocaleSwitcher from "./LocaleSwitcher";
import ThemeToggle from "../ThemeToggle";
import InstallAppButton from "../pwa/InstallAppButton";
import { Button, Avatar } from "../ui";
import { useAuth } from "../../context/AuthContext";
import { Link, useLocalePath, usePathname } from "../../i18n/navigation";
import { isStaff } from "../../utils/rbac";

// Pages de presentation regroupees sous "L'association" (menu deroulant) : l'en-tete garde six
// entrees courtes, sur une seule ligne.
const ASSOCIATION = [
  { href: "/a-propos", key: "about", hint: "aboutHint" },
  { href: "/galerie", key: "gallery", hint: "galleryHint" },
  { href: "/equipe", key: "team", hint: "teamHint" },
  { href: "/transparence", key: "transparency", hint: "transparencyHint" },
];

const NAV = [
  { href: "/projets", key: "projects" },
  { href: "/actualites", key: "news" },
  { href: "/evenements", key: "events" },
  { href: "/rejoindre", key: "join" },
  { href: "/contact", key: "contact" },
];

// Menu "L'association" : bouton a etat (aria-expanded) ; Echap ou un clic a l'exterieur le ferme.
// Dans le menu mobile, il se deplie sur place (meme composant).
function AssociationMenu({ t, isActive }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const active = ASSOCIATION.some((item) => isActive(item.href));

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => !ref.current?.contains(event.target) && setOpen(false);
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      // Echap ferme ce menu sans fermer le menu mobile qui le contient.
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", close);
    ref.current?.addEventListener("keydown", onKey);
    const node = ref.current;
    return () => {
      document.removeEventListener("mousedown", close);
      node?.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <li className={`site-nav__group${open ? " is-open" : ""}`} ref={ref}>
      <button
        type="button"
        ref={buttonRef}
        className={`site-nav__toggle${active ? " is-active" : ""}`}
        aria-expanded={open}
        aria-controls="site-nav-association"
        onClick={() => setOpen((value) => !value)}
      >
        {t("association")}
        <ChevronDown size={16} aria-hidden="true" className="site-nav__chevron" />
      </button>
      <ul id="site-nav-association" className="site-nav__submenu" aria-label={t("associationMenu")} hidden={!open}>
        {ASSOCIATION.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={isActive(item.href) ? "is-active" : undefined}
              aria-current={isActive(item.href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <span className="site-nav__label">{t(item.key)}</span>
              <span className="site-nav__hint">{t(item.hint)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

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
            // eslint-disable-next-line @next/next/no-html-link-for-pages
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
  const [pastMedia, setPastMedia] = useState(false);
  const headerRef = useRef(null);
  const burgerRef = useRef(null);
  const navRef = useRef(null);

  // Changement de page : le menu mobile se ferme pendant le rendu, sans effet ni second rendu.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobileOpen(false);
  }

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

  // Zones sombres ([data-header-overlay] : photo du hero, bandeau d'impact) : le CSS passe l'en-tete
  // en clair ; is-past-media le ramene aux couleurs normales quand aucune n'est sous l'en-tete.
  useEffect(() => {
    const onScroll = () => {
      const isScrolled = window.scrollY > 8;
      setScrolled(isScrolled);
      // Telephone : une fois la page defilee, l'en-tete a un fond (site.css) et garde ses couleurs normales.
      if (isScrolled && compact.matches) {
        setPastMedia(true);
        return;
      }
      const middle = (headerRef.current?.offsetHeight || 0) / 2;
      const overlays = [...document.querySelectorAll("[data-header-overlay]")];
      const underHeader = overlays.some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top <= middle && rect.bottom > middle;
      });
      setPastMedia(overlays.length > 0 && !underHeader);
    };
    const compact = window.matchMedia("(max-width: 960px)");
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header ref={headerRef} className={`site-header${scrolled ? " is-scrolled" : ""}${pastMedia ? " is-past-media" : ""}`}>
      <div className="container site-header__inner">
        <Logo href={lp("/")} label={t("home")} />

        <nav id="site-nav" ref={navRef} className={`site-nav${mobileOpen ? " is-open" : ""}`} aria-label={t("main")}>
          <ul>
            <AssociationMenu key={pathname} t={t} isActive={isActive} />
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
            <InstallAppButton />
            <LocaleSwitcher className="site-nav__locale" />
          </div>
        </nav>

        <div className="site-header__actions">
          <div className="site-header__tools">
            <LocaleSwitcher variant="menu" className="site-header__locale" />
            <ThemeToggle />
          </div>
          <div className="site-header__account">
            {status === "authenticated" && user ? (
              <UserMenu user={user} onLogout={logout} t={t} />
            ) : status === "anonymous" ? (
              <Link href="/connexion" className="site-header__login">{t("login")}</Link>
            ) : null}
          </div>
          <Button href={lp("/don")} variant="accent" size="sm" icon={Heart} className="site-header__donate">
            <span className="site-header__donate-long">{t("donate")}</span>
            <span className="site-header__donate-short" aria-hidden="true">{t("donateShort")}</span>
          </Button>
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
