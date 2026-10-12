import { describe, expect, it } from "vitest";
import { cleanSource } from "@hope/shared/fundraising";
import { donatePath, parseDonateParams } from "@/src/views/fundraising/donateParams";
import { fundraiserPercent } from "@/src/views/fundraising/helpers";
import { EMPTY_TRIBUTE, tributeErrors, tributePayload } from "@/src/views/fundraising/components/TributeFields";
import fundraisingFr from "@/src/i18n/messages/fr/fundraising.json";

const params = (query) => new URLSearchParams(query);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

describe("parametres de la page /don", () => {
  it("pre-remplit un don depuis un lien de relance", () => {
    expect(parseDonateParams(params("montant=25&devise=eur&moyen=card&projet=12&ref=relance&frequence=monthly"))).toEqual({
      amount: 25,
      method: "card",
      frequency: "monthly",
      projectId: "12",
      source: "relance",
      fundraiser: null,
      pledgeRef: null,
    });
  });

  it("deduit le moyen de la devise et rejette les valeurs douteuses", () => {
    const parsed = parseDonateParams(params("montant=-5&devise=xaf&projet=abc&collecte=<script>&engagement=zz&ref=%3Cb%3E"));
    expect(parsed.amount).toBeNull();
    expect(parsed.method).toBe("mobile_money");
    expect(parsed.projectId).toBeNull();
    expect(parsed.fundraiser).toBeNull();
    expect(parsed.pledgeRef).toBeNull();
    expect(parsed.source).toBe("b");
  });

  it("accepte une collecte et un engagement valides", () => {
    const parsed = parseDonateParams(params(`collecte=ma-course-a1b2c3&engagement=${"a".repeat(24)}`));
    expect(parsed.fundraiser).toBe("ma-course-a1b2c3");
    expect(parsed.pledgeRef).toBe("a".repeat(24));
  });

  it("construit le lien de don avec la source", () => {
    expect(donatePath({ fundraiser: "ma-course-a1b2c3", source: "partage-whatsapp" })).toBe("/don?collecte=ma-course-a1b2c3&ref=partage-whatsapp");
    expect(donatePath()).toBe("/don");
  });
});

describe("source des dons", () => {
  it("nettoie et borne la source a 60 caracteres", () => {
    expect(cleanSource("Partage WhatsApp Été")).toBe("partage-whatsapp-ete");
    expect(cleanSource("x".repeat(80))).toHaveLength(60);
    expect(cleanSource("---")).toBeNull();
  });
});

describe("hommage", () => {
  it("ne transmet rien si l'option est desactivee", () => {
    expect(tributePayload(EMPTY_TRIBUTE)).toEqual({});
    expect(tributeErrors(EMPTY_TRIBUTE, EMAIL)).toEqual({});
  });

  it("controle le nom, l'email et la longueur du message", () => {
    const tribute = { enabled: true, type: "memory", name: " ", email: "pas-un-email", message: "x".repeat(301) };
    expect(tributeErrors(tribute, EMAIL)).toEqual({ tributeName: "name", tributeEmail: "email", tributeMessage: "message" });
    for (const key of ["name", "email", "message"]) expect(fundraisingFr.fundraising.tribute.errors[key]).toBeTypeOf("string");
  });

  it("prepare les champs envoyes a l'API", () => {
    expect(tributePayload({ enabled: true, type: "honor", name: " Marie ", email: "", message: " Bravo " })).toEqual({
      tributeType: "honor",
      tributeName: "Marie",
      tributeEmail: undefined,
      tributeMessage: "Bravo",
    });
  });
});

describe("jauge des collectes", () => {
  it("calcule un pourcentage borne", () => {
    expect(fundraiserPercent({ goal_amount: 500, raised: 125 })).toBe(25);
    expect(fundraiserPercent({ goal_amount: 100, raised: 250 })).toBe(100);
    expect(fundraiserPercent({ goal_amount: 0, raised: 10 })).toBe(0);
  });
});
