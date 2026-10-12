import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, buildSecurityHeaders, generateNonce, originOf } from "@/security/headers";

// "script-src a b; img-src c" -> { "script-src": ["a", "b"], "img-src": ["c"] }
function parse(policy) {
  return Object.fromEntries(
    policy.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    })
  );
}

const apiUrls = ["https://api.hope.org/api", "http://backend:5000/api"];

describe("originOf", () => {
  it("extrait l'origine d'une URL absolue", () => {
    expect(originOf("https://api.hope.org/api")).toBe("https://api.hope.org");
    expect(originOf("http://localhost:5000/api/")).toBe("http://localhost:5000");
  });

  it("ignore les valeurs absentes, relatives ou non HTTP", () => {
    expect(originOf(undefined)).toBeNull();
    expect(originOf("/api")).toBeNull();
    expect(originOf("javascript:alert(1)")).toBeNull();
  });
});

describe("generateNonce", () => {
  it("produit un nonce base64 de 128 bits, different a chaque appel", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(generateNonce()).not.toBe(nonce);
  });
});

describe("buildContentSecurityPolicy (production)", () => {
  const csp = parse(buildContentSecurityPolicy({ nonce: "abc123", apiUrls }));

  it("n'autorise que les scripts porteurs du nonce (strict-dynamic) et Stripe", () => {
    expect(csp["script-src"]).toEqual(
      expect.arrayContaining(["'self'", "'nonce-abc123'", "'strict-dynamic'", "https://js.stripe.com"])
    );
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    expect(csp["script-src"]).not.toContain("'unsafe-inline'");
  });

  it("autorise l'API (publique et interne) et Stripe pour les requetes", () => {
    expect(csp["connect-src"]).toEqual(["'self'", "https://api.hope.org", "http://backend:5000", "https://api.stripe.com"]);
  });

  it("autorise les images de l'API (uploads), data: et blob:", () => {
    expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:", "https://api.hope.org", "http://backend:5000"]);
  });

  it("limite les iframes a Stripe et interdit l'inclusion du site", () => {
    expect(csp["frame-src"]).toEqual(expect.arrayContaining(["https://js.stripe.com", "https://hooks.stripe.com"]));
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
  });

  it("verrouille les autres directives", () => {
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp["font-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
  });

  it("deduplique les origines et ignore les URL invalides", () => {
    const policy = parse(
      buildContentSecurityPolicy({
        nonce: "n",
        apiUrls: ["http://localhost:5000/api", "http://localhost:5000/x", undefined, "pas une url"],
      })
    );
    expect(policy["connect-src"]).toEqual(["'self'", "http://localhost:5000", "https://api.stripe.com"]);
  });
});

describe("buildContentSecurityPolicy (developpement)", () => {
  const csp = parse(buildContentSecurityPolicy({ nonce: "abc", isDev: true, apiUrls }));

  it("ajoute 'unsafe-eval' et les websockets du rechargement a chaud", () => {
    expect(csp["script-src"]).toContain("'unsafe-eval'");
    expect(csp["connect-src"]).toEqual(expect.arrayContaining(["ws:", "wss:"]));
  });
});

describe("validation du nonce", () => {
  it("refuse un nonce absent ou capable d'injecter une directive", () => {
    expect(() => buildContentSecurityPolicy({ nonce: "" })).toThrow();
    expect(() => buildContentSecurityPolicy({ nonce: "x'; script-src *" })).toThrow();
  });
});

describe("buildSecurityHeaders", () => {
  it("pose les en-tetes de base, sans HSTS hors production", () => {
    const headers = buildSecurityHeaders({ nonce: "abc", apiUrls });
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Content-Security-Policy"]).toContain("'nonce-abc'");
    expect(headers).not.toHaveProperty("Strict-Transport-Security");
  });

  it("ajoute HSTS en production", () => {
    const headers = buildSecurityHeaders({ nonce: "abc", isProduction: true, apiUrls });
    expect(headers["Strict-Transport-Security"]).toMatch(/^max-age=\d+; includeSubDomains$/);
  });
});
