// Verifie la coherence des dictionnaires : memes cles et memes variables ICU dans chaque
// langue que dans le francais (reference). Usage : node scripts/check-i18n.js
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "src", "i18n", "messages");
const LOCALES = ["fr", "en", "es"];
const REFERENCE = "fr";

function flatten(object, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(object)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

// Noms des arguments ICU de premier niveau ({name}, {count, plural, ...}).
function variables(message) {
  const names = new Set();
  let depth = 0;
  for (let i = 0; i < message.length; i += 1) {
    if (message[i] === "{") {
      if (depth === 0 || depth % 2 === 0) {
        const match = /^\{\s*([A-Za-z_][\w]*)/.exec(message.slice(i));
        if (match) names.add(match[1]);
      }
      depth += 1;
    } else if (message[i] === "}") depth -= 1;
  }
  return [...names].sort().join(",");
}

const files = fs.readdirSync(path.join(DIR, REFERENCE)).filter((file) => file.endsWith(".json"));
let problems = 0;
const report = (text) => {
  problems += 1;
  console.log(text);
};

for (const file of files) {
  const read = (locale) => {
    const target = path.join(DIR, locale, file);
    if (!fs.existsSync(target)) {
      report(`${locale}/${file} : fichier manquant`);
      return {};
    }
    return flatten(JSON.parse(fs.readFileSync(target, "utf8")));
  };
  const reference = read(REFERENCE);
  for (const locale of LOCALES.filter((l) => l !== REFERENCE)) {
    const messages = read(locale);
    for (const key of Object.keys(reference)) {
      if (!(key in messages)) report(`${locale}/${file} : cle manquante ${key}`);
      else if (typeof reference[key] === "string" && variables(reference[key]) !== variables(String(messages[key]))) {
        report(`${locale}/${file} : variables differentes pour ${key} (${variables(reference[key])} / ${variables(String(messages[key]))})`);
      }
    }
    for (const key of Object.keys(messages)) {
      if (!(key in reference)) report(`${locale}/${file} : cle en trop ${key}`);
    }
  }
}

console.log(problems ? `${problems} probleme(s).` : "Dictionnaires coherents.");
process.exitCode = problems ? 1 : 0;
