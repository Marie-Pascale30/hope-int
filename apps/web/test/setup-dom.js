// DOM jsdom installe a la main dans un environnement Vitest "node".
//
// Pourquoi pas `environment: "jsdom"` ? Avec Vite 8, l'environnement "client" resout les paquets
// (node_modules) avec son propre resolveur, qui echoue quand le chemin du depot contient un espace
// (ex. "HOPE Int" : l'espace est encode deux fois, %2520). En environnement "node", Vitest laisse
// Node charger les dependances : les tests passent quel que soit le chemin du depot.
// Ce fichier doit etre le premier de setupFiles (avant tout import de Testing Library).
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "http://localhost:3001/",
  pretendToBeVisual: true,
});
const { window } = dom;

// Classes d'evenements et objets dont la version Node ne convient pas au DOM jsdom
// (dispatchEvent exige les classes jsdom).
const OVERRIDE = new Set(["window", "self", "document", "navigator", "location", "history", "localStorage", "sessionStorage"]);
for (const key of Object.getOwnPropertyNames(window)) {
  if (key.startsWith("_") || key === "undefined" || key === "globalThis") continue;
  const isEventClass = /^(Event|EventTarget|[A-Za-z]*Event)$/.test(key);
  if (key in globalThis && !OVERRIDE.has(key) && !isEventClass) continue;
  Object.defineProperty(globalThis, key, {
    configurable: true,
    enumerable: false,
    get: () => (key === "window" || key === "self" ? window : window[key]),
    set: (value) => {
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    },
  });
}

// React (act) : signale un environnement de test.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
