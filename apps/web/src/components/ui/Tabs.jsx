"use client";

// Onglets accessibles (role tablist / tab / tabpanel).
import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";

// tabs : [{ value, label, count? }]
// id : base des identifiants ; a partager avec <TabPanel tabsId={id} value={value}> qui
// enveloppe le contenu affiche (aria-controls / aria-labelledby).
// Clavier : fleches gauche/droite, Debut/Fin ; un seul onglet dans l'ordre de tabulation.

const tabDomId = (base, value) => `${base}-tab-${String(value).replace(/[^\w-]/g, "_")}`;
const panelDomId = (base) => `${base}-panel`;

export function Tabs({ tabs, value, onChange, label, id }) {
  const t = useTranslations("ui");
  const generated = useId();
  const base = id || generated;
  const listRef = useRef(null);

  // Liste plus large que l'ecran : fondu sur le bord ou il reste des onglets a faire defiler.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const update = () => {
      list.toggleAttribute("data-more-start", list.scrollLeft > 2);
      list.toggleAttribute("data-more-end", list.scrollLeft + list.clientWidth < list.scrollWidth - 2);
    };
    update();
    list.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [tabs.length]);

  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].value);
    listRef.current?.querySelector(`#${CSS.escape(tabDomId(base, tabs[next].value))}`)?.focus();
  };

  return (
    <div ref={listRef} className="tabs" role="tablist" aria-label={label ?? t("tabs")} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = value === tab.value;
        return (
          <button
            key={tab.value}
            id={tabDomId(base, tab.value)}
            type="button"
            role="tab"
            className="tab"
            aria-selected={selected}
            aria-controls={id ? panelDomId(base) : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="tab__count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// Attributs du panneau associe a <Tabs id={tabsId}> (pour un conteneur existant).
export const tabPanelProps = (tabsId, value) => ({
  role: "tabpanel",
  id: panelDomId(tabsId),
  "aria-labelledby": tabDomId(tabsId, value),
});

export function TabPanel({ tabsId, value, className, children }) {
  return (
    <div {...tabPanelProps(tabsId, value)} className={className}>
      {children}
    </div>
  );
}
