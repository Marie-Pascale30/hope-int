"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";

// Traductions de l'habillage du site (navigation, pied de page, accroches de l'accueil).
// Le contenu editorial (projets, actualites...) reste dans la langue de saisie.
const dictionaries = {
  fr: {
    "nav.projects": "Nos projets",
    "nav.news": "Actualités",
    "nav.events": "Agenda",
    "nav.join": "Nous rejoindre",
    "nav.contact": "Contact",
    "nav.donate": "Faire un don",
    "nav.login": "Connexion",
    "nav.account": "Mon espace",
    "nav.admin": "Administration",
    "nav.logout": "Se déconnecter",
    "nav.menu": "Menu",
    "home.eyebrow": "Association de solidarité internationale",
    "home.title": "Investir dans les rêves des familles",
    "home.lead": "Au Cameroun, nous accompagnons les femmes, les jeunes et les communautés rurales vers l'autonomie grâce à la microfinance solidaire, la formation et l'entraide.",
    "home.ctaDonate": "Faire un don",
    "home.ctaDiscover": "Découvrir nos projets",
    "home.ctaTitle": "Changeons des vies, ensemble",
    "home.ctaText": "Chaque contribution renforce une famille, un quartier et une génération. Donnez une fois ou chaque mois, par carte ou Mobile Money.",
    "home.ctaJoin": "Devenir bénévole",
    "footer.tagline": "Microfinance solidaire, formation et entraide au service des familles camerounaises.",
    "footer.explore": "Découvrir",
    "footer.act": "Agir",
    "footer.contact": "Nous contacter",
    "footer.rights": "Tous droits réservés.",
    "footer.language": "Langue",
  },
  en: {
    "nav.projects": "Our projects",
    "nav.news": "News",
    "nav.events": "Events",
    "nav.join": "Join us",
    "nav.contact": "Contact",
    "nav.donate": "Donate",
    "nav.login": "Sign in",
    "nav.account": "My account",
    "nav.admin": "Administration",
    "nav.logout": "Sign out",
    "nav.menu": "Menu",
    "home.eyebrow": "International solidarity organisation",
    "home.title": "Investing in families' dreams",
    "home.lead": "In Cameroon, we help women, young people and rural communities become self-reliant through solidarity microfinance, training and mutual support.",
    "home.ctaDonate": "Donate",
    "home.ctaDiscover": "Discover our projects",
    "home.ctaTitle": "Let's change lives, together",
    "home.ctaText": "Every contribution strengthens a family, a neighbourhood and a generation. Give once or monthly, by card or Mobile Money.",
    "home.ctaJoin": "Volunteer",
    "footer.tagline": "Solidarity microfinance, training and mutual support for Cameroonian families.",
    "footer.explore": "Explore",
    "footer.act": "Take action",
    "footer.contact": "Contact us",
    "footer.rights": "All rights reserved.",
    "footer.language": "Language",
  },
  es: {
    "nav.projects": "Proyectos",
    "nav.news": "Noticias",
    "nav.events": "Agenda",
    "nav.join": "Únete",
    "nav.contact": "Contacto",
    "nav.donate": "Donar",
    "nav.login": "Iniciar sesión",
    "nav.account": "Mi espacio",
    "nav.admin": "Administración",
    "nav.logout": "Cerrar sesión",
    "nav.menu": "Menú",
    "home.eyebrow": "Asociación de solidaridad internacional",
    "home.title": "Invertir en los sueños de las familias",
    "home.lead": "En Camerún, acompañamos a mujeres, jóvenes y comunidades rurales hacia la autonomía con microfinanzas solidarias, formación y ayuda mutua.",
    "home.ctaDonate": "Donar",
    "home.ctaDiscover": "Descubrir los proyectos",
    "home.ctaTitle": "Cambiemos vidas, juntos",
    "home.ctaText": "Cada contribución fortalece una familia, un barrio y una generación. Dona una vez o cada mes, con tarjeta o Mobile Money.",
    "home.ctaJoin": "Ser voluntario",
    "footer.tagline": "Microfinanzas solidarias, formación y ayuda mutua para las familias cameruneses.",
    "footer.explore": "Descubrir",
    "footer.act": "Actuar",
    "footer.contact": "Contacto",
    "footer.rights": "Todos los derechos reservados.",
    "footer.language": "Idioma",
  },
};

export const SUPPORTED_LANGS = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const STORAGE_KEY = "hope_lang";
const LanguageContext = createContext({ lang: "fr", setLang: () => {}, t: (key) => key });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState("fr");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (dictionaries[stored]) setLangState(stored);
    } catch {
      // stockage indisponible : francais par defaut
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!dictionaries[next]) return;
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback((key) => dictionaries[lang]?.[key] || dictionaries.fr[key] || key, [lang]);

  return createElement(LanguageContext.Provider, { value: { lang, setLang, t } }, children);
}

export const useI18n = () => useContext(LanguageContext);
