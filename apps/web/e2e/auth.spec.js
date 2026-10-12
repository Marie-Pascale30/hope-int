import { expect, test } from "@playwright/test";
import { expectMemberSpace, login, m } from "./helpers";

test.describe("Espace membre", () => {
  test("un membre de demo se connecte et arrive dans son espace", async ({ page }) => {
    await login(page);
    await expectMemberSpace(page);
  });

  test("un membre ne peut pas acceder au back-office", async ({ page }) => {
    await login(page);
    await expectMemberSpace(page);

    await page.goto("/admin");
    await expect(page.getByText(m("ui.auth.deniedTitle"))).toBeVisible();
    // Aucune donnee d'administration n'est affichee.
    await expect(page.getByRole("navigation", { name: /admin/i })).toHaveCount(0);
  });

  test("un visiteur anonyme est renvoye vers la connexion", async ({ page }) => {
    await page.goto("/espace");
    await expect(page).toHaveURL(/\/connexion\?next=/);
  });

  test("des identifiants faux affichent une erreur sans connecter", async ({ page }) => {
    await login(page, { email: "alice@hope.org", password: "mauvais-mot-de-passe" });
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/connexion/);
  });
});
