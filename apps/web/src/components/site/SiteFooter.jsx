"use client";

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import Logo from "./Logo";
import { useI18n, SUPPORTED_LANGS } from "../../i18n";
import { useMeta } from "../../hooks/useMeta";

export default function SiteFooter() {
  const { t, lang, setLang } = useI18n();
  const { meta } = useMeta();
  const org = meta.organization;

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Logo light />
          <p>{t("footer.tagline")}</p>
          <label className="site-footer__lang">
            <span>{t("footer.language")}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              {SUPPORTED_LANGS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <h2 className="site-footer__title">{t("footer.explore")}</h2>
          <ul>
            <li><Link href="/projets">{t("nav.projects")}</Link></li>
            <li><Link href="/actualites">{t("nav.news")}</Link></li>
            <li><Link href="/evenements">{t("nav.events")}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="site-footer__title">{t("footer.act")}</h2>
          <ul>
            <li><Link href="/don">{t("nav.donate")}</Link></li>
            <li><Link href="/rejoindre">{t("nav.join")}</Link></li>
            <li><Link href="/espace">{t("nav.account")}</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="site-footer__title">{t("footer.contact")}</h2>
          <ul className="site-footer__contact">
            {org.address && <li><MapPin size={16} aria-hidden="true" /> {org.address}</li>}
            {org.email && <li><Mail size={16} aria-hidden="true" /> {org.email}</li>}
            {org.phone && <li><Phone size={16} aria-hidden="true" /> {org.phone}</li>}
            <li><Link href="/contact">{t("nav.contact")} →</Link></li>
          </ul>
        </div>
      </div>
      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} {org.name}. {t("footer.rights")}</span>
      </div>
    </footer>
  );
}
