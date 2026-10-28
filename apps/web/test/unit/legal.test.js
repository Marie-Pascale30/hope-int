import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { TIME_ZONE } from "@/src/i18n/config";
import legalEn from "@/src/i18n/messages/en/legal.json";
import legalEs from "@/src/i18n/messages/es/legal.json";
import legalFr from "@/src/i18n/messages/fr/legal.json";
import { LEGAL_UPDATED_AT, legalConfig, siteHost } from "@/src/views/site/legal";

// Mentions legales / confidentialite : configuration par variables d'environnement et textes ICU.
describe("legalConfig", () => {
  it("laisse vides les valeurs non configurees et applique les durees par defaut de l'API", () => {
    const config = legalConfig({});
    expect(config.registrationNumber).toBe("");
    expect(config.publicationDirector).toBe("");
    expect(config.host).toEqual({ name: "", address: "", contact: "" });
    expect(config.retention).toEqual({ outboxDays: 30, logsMonths: 12, refusedMonths: 24, accountingYears: 10 });
  });

  it("lit les variables renseignees et ignore les durees invalides", () => {
    const config = legalConfig({
      LEGAL_REGISTRATION_NUMBER: "  N° 123  ",
      LEGAL_HOST_NAME: "Hebergeur",
      RETENTION_LOGS_MONTHS: "6",
      ACCOUNTING_RETENTION_YEARS: "abc",
    });
    expect(config.registrationNumber).toBe("N° 123");
    expect(config.host.name).toBe("Hebergeur");
    expect(config.retention.logsMonths).toBe(6);
    expect(config.retention.accountingYears).toBe(10);
  });

  it("affiche le domaine du site", () => {
    expect(siteHost("https://hopeintapp.com")).toBe("hopeintapp.com");
    expect(LEGAL_UPDATED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// Chaque texte se formate sans erreur ICU dans chaque langue (balises et variables fournies).
const tag = (chunks) => chunks;
const VALUES = {
  name: "HOPE International Project",
  host: "hopeintapp.com",
  email: "contact@example.org",
  address: "Douala",
  outboxDays: 30,
  logsMonths: 12,
  refusedMonths: 24,
  accountingYears: 10,
  date: new Date(`${LEGAL_UPDATED_AT}T12:00:00Z`),
  ...Object.fromEntries(["strong", "mail", "site", "account", "prefs", "contact", "privacy", "notice", "time"].map((key) => [key, tag])),
};

function leaves(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === "object" ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  );
}

describe.each([["fr", legalFr], ["en", legalEn], ["es", legalEs]])("textes legaux (%s)", (locale, messages) => {
  it("se formatent tous", () => {
    const errors = [];
    const t = createTranslator({ locale, messages, namespace: "legal", timeZone: TIME_ZONE, onError: (error) => errors.push(error.message) });
    for (const key of leaves(messages.legal)) {
      const value = t.rich(key, VALUES);
      expect(value, key).toBeTruthy();
    }
    expect(errors).toEqual([]);
  });
});
