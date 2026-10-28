import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { LOCALES } from "@/src/i18n/config";

// Chaque espace de noms litteral passe a useTranslations / getTranslations doit exister dans les
// messages de chaque langue (une accolade mal placee lors d'une fusion avait sorti "ui.phone" de "ui").
const ROOT = path.resolve(__dirname, "../..");
const NAMESPACE_RE = /(?:useTranslations|getTranslations)\(\s*(?:\{[^}]*namespace:\s*)?"([\w.]+)"/g;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "messages" ? [] : sourceFiles(full);
    return /\.jsx?$/.test(entry.name) ? [full] : [];
  });
}

function loadMessages(locale) {
  const dir = path.join(ROOT, "src/i18n/messages", locale);
  return Object.assign({}, ...fs.readdirSync(dir).map((file) => JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"))));
}

const namespaces = new Map();
for (const file of [...sourceFiles(path.join(ROOT, "src")), ...sourceFiles(path.join(ROOT, "app"))]) {
  for (const [, namespace] of fs.readFileSync(file, "utf8").matchAll(NAMESPACE_RE)) {
    namespaces.set(namespace, path.relative(ROOT, file));
  }
}

describe("espaces de noms des traductions", () => {
  it("trouve des espaces de noms dans le code", () => {
    expect(namespaces.size).toBeGreaterThan(20);
  });

  it.each(LOCALES)("existent tous dans les messages %s", (locale) => {
    const messages = loadMessages(locale);
    const missing = [...namespaces]
      .filter(([namespace]) => namespace.split(".").reduce((node, key) => node?.[key], messages) === undefined)
      .map(([namespace, file]) => `${namespace} (${file})`);
    expect(missing).toEqual([]);
  });
});
