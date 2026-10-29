// Aides partagees par les scenarios e2e : textes francais lus dans les dictionnaires
// (pas de libelle recopie en dur) et connexion d'un compte de demonstration.
// Playwright transpile ces fichiers en CommonJS (le paquet n'est pas "type": "module") : __dirname.
import fs from "node:fs";
import path from "node:path";
import { expect } from "@playwright/test";

const MESSAGES_DIR = path.join(__dirname, "..", "src", "i18n", "messages");

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
  // Texte tel qu'affiche : sans les balises de mise en forme de t.rich (<hl>, <strong>, <link>...).
  return value.replace(/<\/?[a-zA-Z]+>/g, "");
}

// Comptes crees par npm run seed (voir README).
export const DEMO_MEMBER = { email: "alice@hope.org", password: "Member@123" };

/**
 * Connexion par le formulaire /connexion.
 * Comptes non-equipe uniquement (membre, invite) : un compte de l'equipe (access_admin_dashboard)
 * doit saisir un code envoye par email, que Playwright ne peut pas lire. Un scenario de
 * back-office devra d'abord inserer un appareil de confiance en base (table trusted_devices,
 * empreinte SHA-256 du jeton, token_version du compte) et poser le cookie hope_device
 * (path /api/auth) dans le contexte du navigateur ; aucune option de contournement n'existe dans l'API.
 */
// Champs cherches par nom accessible (role textbox) : le texte du <label> contient l'asterisque des
// champs obligatoires (aria-hidden), que getByLabel ne retire pas.
export async function login(page, { email, password } = DEMO_MEMBER) {
  await page.goto("/connexion");
  await page.getByRole("textbox", { name: m("account.fields.email"), exact: true }).fill(email);
  await page.getByRole("textbox", { name: m("account.fields.password"), exact: true }).fill(password);
  await page.getByRole("button", { name: m("account.login.submit") }).click();
}

/** Attend l'espace membre apres connexion. */
export async function expectMemberSpace(page) {
  await expect(page).toHaveURL(/\/espace(?:[/?#]|$)/);
  await expect(page.getByRole("button", { name: m("account.space.logout") }).or(
    page.getByRole("link", { name: m("account.space.logout") })
  )).toBeVisible();
}
