const { MESSAGES, TEMPLATES } = require("./messages");

// Langues du site : le francais est la langue de reference des messages de l'API.
const LOCALES = ["fr", "en", "es"];
const INDEX = { en: 0, es: 1 };

function resolveLocale(req) {
    return req.acceptsLanguages(...LOCALES) || "fr";
}

function translate(message, locale) {
    if (typeof message !== "string" || !(locale in INDEX)) return message;
    const entry = MESSAGES[message];
    if (entry) return entry[INDEX[locale]];
    for (const template of TEMPLATES) {
        const match = message.match(template.pattern);
        if (match) return template[locale](...match.slice(1));
    }
    return message;
}

// Traduit les messages destines a l'utilisateur (error, message, errors[].msg) selon
// Accept-Language, au moment de l'envoi : les services restent ecrits en francais.
function localizeResponses(req, res, next) {
    res.vary("Accept-Language");
    const locale = resolveLocale(req);
    if (locale === "fr") return next();

    const json = res.json.bind(res);
    res.json = (body) => {
        if (body && typeof body === "object" && !Array.isArray(body)) {
            const localized = { ...body };
            if (typeof localized.error === "string") localized.error = translate(localized.error, locale);
            if (typeof localized.message === "string") localized.message = translate(localized.message, locale);
            if (Array.isArray(localized.errors)) {
                localized.errors = localized.errors.map((item) =>
                    item && typeof item.msg === "string" ? { ...item, msg: translate(item.msg, locale) } : item
                );
            }
            return json(localized);
        }
        return json(body);
    };
    next();
}

module.exports = { LOCALES, resolveLocale, translate, localizeResponses };
