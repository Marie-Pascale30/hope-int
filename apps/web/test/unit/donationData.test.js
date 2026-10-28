import { describe, expect, it } from "vitest";
import {
  convertAmount, impactKey, parseAmount, PRESET_AMOUNTS, stripeErrorMessage, toEur,
} from "@/src/views/account/components/donationData";
import { message, translator } from "../intl";

describe("impactKey", () => {
  it("choisit le palier d'impact le plus eleve atteint", () => {
    expect(impactKey(0)).toBe("fund");
    expect(impactKey(5)).toBe("hygieneKit");
    expect(impactKey(24.99)).toBe("schoolKit");
    expect(impactKey(50)).toBe("medical");
    expect(impactKey(75)).toBe("business");
    expect(impactKey(1000)).toBe("sponsorship");
    expect(impactKey("abc")).toBe("fund");
  });

  it("a un texte francais pour chaque palier", () => {
    for (const amount of [0, 5, 10, 25, 50, 75, 250]) {
      expect(message(`account.donate.impact.${impactKey(amount)}`)).toBeTypeOf("string");
    }
  });
});

describe("conversions", () => {
  const rate = 655.957;

  it("arrondit les FCFA a la centaine et les euros a l'unite (minimum 1)", () => {
    expect(convertAmount(25, "eur", "xaf", rate)).toBe(16400);
    expect(convertAmount(10000, "xaf", "eur", rate)).toBe(15);
    expect(convertAmount(100, "xaf", "eur", rate)).toBe(1);
    expect(convertAmount(42, "eur", "eur", rate)).toBe(42);
  });

  it("ramene un montant en euros", () => {
    expect(toEur(50, "eur", rate)).toBe(50);
    expect(toEur(rate * 2, "xaf", rate)).toBeCloseTo(2);
  });

  it("propose des montants suggeres croissants dans les deux devises", () => {
    for (const amounts of Object.values(PRESET_AMOUNTS)) {
      expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
    }
  });
});

describe("parseAmount", () => {
  it("accepte virgule, point et espaces de milliers", () => {
    expect(parseAmount("25", "eur")).toBe(25);
    expect(parseAmount("25,50", "eur")).toBe(25.5);
    expect(parseAmount("10 000", "xaf")).toBe(10000);
    expect(parseAmount("10 000", "xaf")).toBe(10000);
    expect(parseAmount("99.5", "xaf")).toBe(100);
  });

  it("rejette les saisies invalides", () => {
    for (const value of ["", "abc", "-5", "1,234", "12.345", null]) {
      expect(parseAmount(value, "eur")).toBeNaN();
    }
  });
});

describe("stripeErrorMessage", () => {
  const t = translator("account.stripe");

  it("traduit les codes Stripe connus (decline_code prioritaire)", () => {
    expect(stripeErrorMessage({ code: "card_declined", decline_code: "insufficient_funds" }, t)).toBe(
      message("account.stripe.insufficient_funds")
    );
    expect(stripeErrorMessage({ code: "expired_card" }, t)).toBe(message("account.stripe.expired_card"));
  });

  it("garde le message de Stripe pour une erreur de saisie inconnue", () => {
    expect(stripeErrorMessage({ type: "validation_error", code: "x", message: "Numero incomplet" }, t)).toBe("Numero incomplet");
  });

  it("utilise le message de repli sinon", () => {
    expect(stripeErrorMessage({ type: "api_error" }, t)).toBe(message("account.stripe.fallback"));
    expect(stripeErrorMessage(null, t)).toBe("");
  });
});
