import { expect, test } from "@playwright/test";
import { m } from "./helpers";

test("bascule de langue fr -> en sur /projets", async ({ page }) => {
  await page.goto("/projets");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1, name: m("site.projects.title") })).toBeVisible();

  // Menu de langue de l'en-tete : bouton "Langue : Francais. Changer de langue", puis lien reel.
  await page.getByRole("banner").getByRole("button", { name: /Changer de langue/ }).click();
  await page.getByRole("banner").getByRole("link", { name: "English" }).click();

  await expect(page).toHaveURL(/\/en\/projets$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1, name: m("site.projects.title", "en") })).toBeVisible();

  // Le choix est memorise dans le cookie de preference lu par le proxy.
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === "NEXT_LOCALE")?.value).toBe("en");
});

test("les pages portent les en-tetes de securite (CSP avec nonce)", async ({ page }) => {
  const response = await page.goto("/projets");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

  // Aucune violation CSP pendant le chargement de la page.
  const violations = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await page.reload();
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});
