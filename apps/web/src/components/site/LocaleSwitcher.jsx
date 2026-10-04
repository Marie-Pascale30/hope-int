"use client";

// Selecteur de langue : de vrais liens (lisibles sans JavaScript, indexables) vers la meme page
// dans chaque langue. Le clic met a jour le cookie de preference NEXT_LOCALE.
// variant "list" : liste en ligne (pied de page, menu mobile) ; "menu" : bouton compact + panneau (en-tete).
import { Suspense, useEffect, useId, useRef, useState } from "react";
import NextLink from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_NAMES, localizePath } from "../../i18n/config";
import { usePathname } from "../../i18n/navigation";

// Memorise le choix avant la navigation : le proxy ne redirige plus vers l'ancienne langue.
function rememberLocale(code) {
  document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

function LocaleLinks({ href, onNavigate, className }) {
  const locale = useLocale();
  return (
    <ul className={className}>
      {LOCALES.map((code) => {
        const current = code === locale;
        return (
          <li key={code}>
            <NextLink
              href={localizePath(code, href)}
              hrefLang={code}
              lang={code}
              prefetch={false}
              aria-current={current ? "true" : undefined}
              className={current ? "is-current" : undefined}
              onClick={() => {
                rememberLocale(code);
                onNavigate?.();
              }}
            >
              {current && <Check size={14} aria-hidden="true" />}
              {LOCALE_NAMES[code]}
            </NextLink>
          </li>
        );
      })}
    </ul>
  );
}

// Conserve la query string (ex. /don?projet=3) ; useSearchParams exige une frontiere Suspense.
function LinksWithSearch({ pathname, ...props }) {
  const search = useSearchParams()?.toString();
  return <LocaleLinks href={search ? `${pathname}?${search}` : pathname} {...props} />;
}

function Links(props) {
  const pathname = usePathname();
  return (
    <Suspense fallback={<LocaleLinks href={pathname} {...props} />}>
      <LinksWithSearch pathname={pathname} {...props} />
    </Suspense>
  );
}

function LocaleMenu({ className = "" }) {
  const t = useTranslations("language");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => !ref.current?.contains(event.target) && setOpen(false);
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`locale-menu ${className}`.trim()} ref={ref}>
      <button
        type="button"
        ref={buttonRef}
        className="locale-menu__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("current", { language: LOCALE_NAMES[locale] })}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe size={17} aria-hidden="true" />
        <span aria-hidden="true">{locale.toUpperCase()}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div id={panelId} className="locale-menu__panel" hidden={!open}>
        <Links className="locale-menu__list" onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}

export default function LocaleSwitcher({ variant = "list", onDark, className = "" }) {
  const t = useTranslations("language");
  if (variant === "menu") return <LocaleMenu className={className} />;
  return (
    <nav className={`locale-switch${onDark ? " locale-switch--on-dark" : ""} ${className}`.trim()} aria-label={t("label")}>
      <span className="locale-switch__label" aria-hidden="true">{t("label")}</span>
      <Links className="locale-switch__list" />
    </nav>
  );
}
