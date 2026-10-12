// Aides partagees par les scenarios e2e : textes francais lus dans les dictionnaires
// (pas de libelle recopie en dur) et connexion d'un compte de demonstration.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";

const MESSAGES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n", "messages");

function load(locale) {
  return ["common", "site", "account", "admin", "adminOps"].reduce((all, file) => {
    const content = JSON.parse(fs.readFileSync(path.join(MESSAGES_DIR, locale, `${file}.json`), "utf8"));
    return { ...all, ...content };
  }, {});
}

const catalogs = { fr: load("fr"), en: load("en") };

/** Texte d'une cle "a.b.c" (francais par defaut). */
export function m(key, locale = "fr") {
  const value = key.split(".").reduce((node, part) => node?.[part], catalogs[locale]);
  if (typeof value !== "string") throw new Error(`Cle de traduction introuvable : ${key} (${locale})`);
  return value;
}

// Comptes crees par npm run seed (voir README).
export const DEMO_MEMBER = { email: "alice@hope.org", password: "Member@123" };

/** Connexion par le formulaire /connexion. */
export async function login(page, { email, password } = DEMO_MEMBER) {
  await page.goto("/connexion");
  await page.getByLabel(m("account.fields.email"), { exact: true }).fill(email);
  await page.getByLabel(m("account.fields.password"), { exact: true }).fill(password);
  await page.getByRole("button", { name: m("account.login.submit") }).click();
}

/** Attend l'espace membre apres connexion. */
export async function expectMemberSpace(page) {
  await expect(page).toHaveURL(/\/espace(?:[/?#]|$)/);
  await expect(page.getByRole("button", { name: m("account.space.logout") }).or(
    page.getByRole("link", { name: m("account.space.logout") })
  )).toBeVisible();
}
