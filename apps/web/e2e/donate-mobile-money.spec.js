import { expect, test } from "@playwright/test";
import { m } from "./helpers";

// Parcours de don Mobile Money sans paiement reel : la CI ne configure aucun prestataire.
// - GET /api/meta est relu puis modifie pour declarer Notch Pay actif ;
// - POST /api/payment/donations est simule et renvoie une URL de paiement fictive ;
// - cette URL est elle-meme interceptee : on s'arrete a la redirection vers le prestataire.
const CHECKOUT_URL = "https://paiement.example.test/checkout/demo";

test("don Mobile Money anonyme jusqu'a la redirection vers le prestataire", async ({ page }) => {
  await page.route("**/api/meta", async (route) => {
    const response = await route.fetch();
    const meta = await response.json();
    meta.providers = { ...meta.providers, mobileMoney: true, mobileMoneyProvider: "notchpay", notchpay: true };
    await route.fulfill({ response, json: meta });
  });

  let donationRequest = null;
  await page.route("**/api/payment/donations", async (route) => {
    donationRequest = route.request().postDataJSON();
    await route.fulfill({ status: 201, json: { paymentId: 1, provider: "notchpay", receiptToken: "a".repeat(48), redirectUrl: CHECKOUT_URL } });
  });
  await page.route(`${CHECKOUT_URL}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Prestataire simule</title><h1>Paiement Notch Pay simule</h1>" })
  );

  await page.goto("/don");

  // Etape 1 : moyen de paiement Mobile Money (devise FCFA).
  // Les boutons radio sont stylises (input masque visuellement) : check({ force: true }).
  await page.locator('input[name="don-moyen"][value="mobile_money"]').check({ force: true });

  // Etape 2 : premier montant suggere en FCFA (5 000).
  await page
    .getByRole("radiogroup", { name: m("account.donate.amount.suggested") })
    .locator('input[name="don-montant"]')
    .first()
    .check({ force: true });

  // Etape 4 : coordonnees du donateur et numero Mobile Money camerounais.
  await page.getByRole("textbox", { name: m("account.donate.donor.name"), exact: true }).fill("Donatrice E2E");
  await page.getByRole("textbox", { name: m("account.donate.donor.email"), exact: true }).fill("donatrice.e2e@example.com");
  await page.getByRole("textbox", { name: m("account.donate.donor.phone"), exact: true }).fill("6 77 12 34 56");

  // Etape 5 : validation (le bouton annonce le montant en FCFA).
  const submit = page.getByRole("button", { name: /FCFA/ }).last();
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page).toHaveURL(CHECKOUT_URL);
  await expect(page.getByRole("heading", { name: "Paiement Notch Pay simule" })).toBeVisible();

  expect(donationRequest).toMatchObject({
    provider: "mobile_money",
    frequency: "once",
    amount: 5000,
    donorName: "Donatrice E2E",
    donorEmail: "donatrice.e2e@example.com",
    phone: "+237677123456",
  });
});
