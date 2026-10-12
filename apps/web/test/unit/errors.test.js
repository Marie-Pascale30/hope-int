import { describe, expect, it } from "vitest";
import { errorMessage } from "@/src/i18n/errors";
import { message, translator } from "../intl";

const t = translator("errors");

describe("errorMessage", () => {
  it("affiche le message renvoye (et deja traduit) par l'API", () => {
    expect(errorMessage(t, { response: { data: { error: "Email deja utilise" } } })).toBe("Email deja utilise");
  });

  it("signale le premier champ invalide d'express-validator", () => {
    const error = { response: { data: { errors: [{ path: "email" }, { path: "name" }] } } };
    expect(errorMessage(t, error)).toBe(message("errors.invalidField").replace("{field}", "email"));
  });

  it("utilise ? si le champ invalide n'est pas nomme", () => {
    const error = { response: { data: { errors: [{}] } } };
    expect(errorMessage(t, error)).toBe(message("errors.invalidField").replace("{field}", "?"));
  });

  it("distingue delai depasse, erreur reseau et erreur inconnue", () => {
    expect(errorMessage(t, { code: "ECONNABORTED" })).toBe(message("errors.timeout"));
    expect(errorMessage(t, { message: "Network Error" })).toBe(message("errors.network"));
    expect(errorMessage(t, new Error("boom"))).toBe(message("errors.generic"));
    expect(errorMessage(t, undefined)).toBe(message("errors.generic"));
  });
});
