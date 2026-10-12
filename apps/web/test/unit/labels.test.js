import { describe, expect, it } from "vitest";
import { makeLabels, STATUS_KEYS, TONES } from "@/src/utils/labels";
import { message, translator } from "../intl";

const labels = makeLabels(translator("labels"));

describe("makeLabels", () => {
  it("traduit un statut et lui associe sa tonalite de badge", () => {
    expect(labels.status("paymentStatus", "succeeded")).toEqual({
      label: message("labels.paymentStatus.succeeded"),
      tone: "success",
    });
    expect(labels.status("paymentStatus", "review").tone).toBe("warning");
  });

  it("retombe sur la cle brute (ou un tiret) pour un statut inconnu", () => {
    expect(labels.status("paymentStatus", "inconnu")).toEqual({ label: "inconnu", tone: "" });
    expect(labels.status("paymentStatus", null)).toEqual({ label: "—", tone: "" });
    expect(labels.status("groupeInexistant", "x").tone).toBe("");
  });

  it("traduit roles, moyens de paiement et frequences", () => {
    expect(labels.role("admin")).toBe(message("labels.role.admin"));
    expect(labels.role(undefined)).toBe(message("labels.role.membre"));
    expect(labels.method("mobile_money")).toBe(message("labels.paymentMethod.mobile_money"));
    expect(labels.frequency("monthly")).toBe(message("labels.frequency.monthly"));
  });

  it("a un libelle francais pour chaque statut connu", () => {
    for (const [group, keys] of Object.entries(STATUS_KEYS)) {
      for (const key of keys) {
        expect(message(`labels.${group}.${key}`), `labels.${group}.${key}`).toBeTypeOf("string");
      }
    }
    expect(Object.keys(STATUS_KEYS)).toEqual(Object.keys(TONES));
  });
});
