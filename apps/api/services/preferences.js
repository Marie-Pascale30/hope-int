// Preferences de communication (RGPD) : point d'entree stable appele par tous les modules avant
// un envoi non transactionnel. La logique est dans consentService (module "engagement").
//
// Sujets : "donation_reminders", "project_news", "newsletter", "event_reminders".
// - newsletter : accord explicite obligatoire (aucun envoi sans inscription confirmee) ;
// - autres sujets : autorises tant que la personne ne les a pas refuses.
const consentService = require("./consentService");
const { CONSENT_TOPICS, isOptInTopic } = require("@hope/shared/engagement");

// Le destinataire accepte-t-il ce sujet ? Ne leve jamais d'erreur : en cas de base indisponible,
// la regle par defaut s'applique (newsletter refusee, autres sujets autorises).
exports.canContact = async (email, topic) => {
    try {
        return await consentService.canContact(email, topic);
    } catch (error) {
        console.error("preferences-can-contact:", error.message);
        return Boolean(email) && CONSENT_TOPICS.includes(topic) && !isOptInTopic(topic);
    }
};

// Pied d'email (texte) avec lien signe de desinscription et de gestion des preferences, sans connexion.
// options.campaignId : rattache une desinscription a une campagne (statistiques).
exports.unsubscribeFooter = async (email, topic, options = {}) => {
    try {
        return consentService.unsubscribeFooter(email, topic, options);
    } catch (error) {
        console.error("preferences-footer:", error.message);
        return "";
    }
};

// Enregistre les cases de consentement d'un formulaire (inscription, don) :
// recordConsents({ email, userId, consents: { newsletter: true, project_news: false }, source: "donation", locale }).
exports.recordConsents = (options) => consentService.recordFromForm(options);

exports.TOPICS = CONSENT_TOPICS;
