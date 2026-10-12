import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/security/headers";
import { pwaInitScript } from "@/app/_lib/pwa";

const root = path.resolve(__dirname, "../..");
const ORIGIN = "https://hope.example";

// Charge public/sw.js avec un faux contexte de service worker et renvoie self.HOPE_SW.
function loadWorker() {
  const listeners = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, handler) => { listeners[type] = handler; },
  };
  const source = fs.readFileSync(path.join(root, "public/sw.js"), "utf8");
  new Function("self", "caches", "fetch", source)(self, {}, () => {});
  return { sw: self.HOPE_SW, listeners };
}

function request(url, { method = "GET", mode = "navigate", headers = {} } = {}) {
  const map = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return { url: `${ORIGIN}${url}`, method, mode, headers: { get: (name) => map.get(name.toLowerCase()) || null } };
}

describe("service worker", () => {
  const { sw, listeners } = loadWorker();

  it("ecoute installation, activation, requetes et messages", () => {
    expect(Object.keys(listeners).sort()).toEqual(["activate", "fetch", "install", "message"]);
    expect(sw.PRECACHE).toEqual(expect.arrayContaining(["/hors-ligne", "/en/hors-ligne", "/es/hors-ligne", "/offline.html"]));
  });

  it("met en cache les pages publiques (reseau d'abord) et les ressources statiques", () => {
    expect(sw.classify(request("/"), ORIGIN)).toBe("page");
    expect(sw.classify(request("/en/projets/3"), ORIGIN)).toBe("page");
    expect(sw.classify(request("/transparence"), ORIGIN)).toBe("page");
    expect(sw.classify(request("/_next/static/chunks/app.js", { mode: "no-cors" }), ORIGIN)).toBe("static");
    expect(sw.classify(request("/_next/image?url=x&w=256", { mode: "no-cors" }), ORIGIN)).toBe("image");
  });

  it("ne met jamais en cache l'API, l'administration, l'espace membre, le don ni l'authentification", () => {
    // Navigations vers une page personnelle : reseau seul (page hors ligne en cas d'echec).
    for (const url of ["/admin", "/admin/budget", "/espace", "/don", "/en/don/merci", "/es/espace", "/connexion", "/changer-mot-de-passe"]) {
      expect(sw.classify(request(url), ORIGIN), url).toBe("private-page");
      expect(sw.classify(request(url, { mode: "cors" }), ORIGIN), url).toBe("none");
    }
    for (const url of ["/api/impact", "/uploads/photo.jpg", "/payment/retour"]) {
      expect(sw.classify(request(url), ORIGIN), url).toBe("none");
    }
    expect(sw.classify(request("/projets", { headers: { Authorization: "Bearer x" } }), ORIGIN)).toBe("none");
    expect(sw.classify(request("/projets", { method: "POST" }), ORIGIN)).toBe("none");
    expect(sw.classify({ ...request("/"), url: "https://api.hope.example/api/payment/donations" }, ORIGIN)).toBe("none");
    expect(sw.classify(request("/projets", { mode: "cors", headers: { RSC: "1" } }), ORIGIN)).toBe("none");
  });

  it("sert la page hors ligne de la langue", () => {
    expect(sw.offlinePathFor("/projets")).toBe("/hors-ligne");
    expect(sw.offlinePathFor("/en/projets")).toBe("/en/hors-ligne");
    expect(sw.offlinePathFor("/es")).toBe("/es/hors-ligne");
    expect(sw.isPrivatePath("/donateurs")).toBe(false);
  });
});

describe("application installable", () => {
  it("declare un manifeste complet avec des icones PNG presentes", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "public/manifest.json"), "utf8"));
    expect(manifest).toMatchObject({ id: "/", scope: "/", lang: "fr", display: "standalone" });
    expect(manifest.start_url.startsWith("/")).toBe(true);
    const sizes = manifest.icons.filter((icon) => icon.type === "image/png").map((icon) => `${icon.sizes}:${icon.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "192x192:maskable", "512x512:maskable"]));
    for (const icon of manifest.icons) {
      // /icon.svg est servi par la convention de fichier de Next (app/icon.svg).
      const exists = fs.existsSync(path.join(root, "public", icon.src)) || fs.existsSync(path.join(root, "app", icon.src));
      expect(exists, icon.src).toBe(true);
    }
    expect(fs.existsSync(path.join(root, "public/icons/apple-touch-icon.png"))).toBe(true);
  });

  it("autorise le service worker et le manifeste dans la CSP", () => {
    const csp = buildContentSecurityPolicy({ nonce: "abc" });
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("manifest-src 'self'");
  });

  it("n'enregistre le service worker qu'en production et lit la preference eco", () => {
    expect(pwaInitScript({ registerWorker: true })).toContain('navigator.serviceWorker.register("/sw.js"');
    expect(pwaInitScript({ registerWorker: false })).not.toContain("serviceWorker");
    const script = pwaInitScript({ registerWorker: false });
    document.cookie = "hope_eco=1; path=/";
    new Function(script)();
    expect(document.documentElement.dataset.eco).toBe("1");
    document.cookie = "hope_eco=0; path=/";
    delete document.documentElement.dataset.eco;
    new Function(script)();
    expect(document.documentElement.dataset.eco).toBeUndefined();
  });
});
