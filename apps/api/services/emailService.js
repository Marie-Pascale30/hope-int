const transport = require("./emailTransport");
const outbox = require("./emailOutbox");

const isProduction = process.env.NODE_ENV === "production";
const ORG_NAME = process.env.ORG_NAME || "HOPE International";

const { hasMailConfig } = transport;

// Semantique des valeurs de retour (inchangee pour les appelants) :
// - SMTP non configure : rien n'est mis en file, email affiche en console hors production,
//   { sent: false, queued: false, reason: "smtp-not-configured" } ;
// - SMTP configure : l'email est enregistre dans email_outbox puis envoye par le worker avec
//   nouvelles tentatives. sent: true signifie "pris en charge pour envoi" : { sent: true, queued: true } ;
// - options.immediate (identifiants) : envoi tente tout de suite, sans nouvel essai ;
//   { sent: true, queued: true } si parti, sinon { sent: false, queued: false, reason: "smtp-error" }
//   (l'appelant peut alors communiquer le contenu autrement, ex. mot de passe montre a l'admin).
async function send({ to, subject, text, attachments }, options = {}) {
    if (!hasMailConfig()) {
        if (!isProduction) {
            console.log(`
[email non envoyé - SMTP non configuré]
À : ${to}
Objet : ${subject}
${text}
`);
        }
        return { sent: false, queued: false, reason: "smtp-not-configured" };
    }

    const message = {
        kind: options.kind,
        to,
        subject,
        text,
        attachments,
        paymentId: options.paymentId,
        sensitive: options.sensitive,
        expiresInMinutes: options.expiresInMinutes,
    };

    if (options.immediate) {
        try {
            const result = await outbox.sendNow(message);
            return result.sent ? { sent: true, queued: true } : { sent: false, queued: false, reason: "smtp-error" };
        } catch (error) {
            console.error("email-error:", error.message);
            return { sent: false, queued: false, reason: "smtp-error" };
        }
    }

    try {
        await outbox.enqueue(message);
        return { sent: true, queued: true };
    } catch (error) {
        // File indisponible (base, migration manquante) : envoi direct en dernier recours.
        console.error("email-outbox-enqueue-error:", error.message);
        try {
            await transport.deliver(message);
            return { sent: true, queued: false };
        } catch (sendError) {
            console.error("email-error:", sendError.message);
            return { sent: false, queued: false, reason: "smtp-error" };
        }
    }
}

exports.hasMailConfig = hasMailConfig;
exports.send = (message) => send(message);

exports.sendNewCredentialsEmail = ({ to, fullName, password, loginUrl }) =>
    send({
        to,
        subject: `${ORG_NAME} - Vos identifiants`,
        text: [
            `Bonjour ${fullName},`,
            "",
            `Votre compte a été créé sur la plateforme ${ORG_NAME}.`,
            `Email : ${to}`,
            `Mot de passe provisoire : ${password}`,
            loginUrl ? `Connexion : ${loginUrl}` : "",
            "",
            "Vous devrez choisir un nouveau mot de passe lors de votre première connexion.",
        ].join("\n"),
    }, { kind: "credentials", sensitive: true, immediate: true });

exports.sendPasswordResetEmail = ({ to, fullName, resetUrl }) =>
    send({
        to,
        subject: `${ORG_NAME} - Réinitialisation du mot de passe`,
        text: [
            `Bonjour ${fullName},`,
            "",
            "Vous avez demandé à réinitialiser votre mot de passe. Ce lien est valable 1 heure :",
            resetUrl,
            "",
            "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message.",
        ].join("\n"),
    }, { kind: "password_reset", sensitive: true, expiresInMinutes: 55 });

exports.sendApplicationReceivedEmail = ({ to, fullName }) =>
    send({
        to,
        subject: `${ORG_NAME} - Candidature bien reçue`,
        text: [
            `Bonjour ${fullName},`,
            "",
            `Merci pour votre candidature ! L'équipe ${ORG_NAME} va l'étudier et reviendra vers vous rapidement.`,
        ].join("\n"),
    }, { kind: "application_received" });

exports.sendApplicationDecisionEmail = ({ to, fullName, accepted, note }) =>
    send({
        to,
        subject: `${ORG_NAME} - Votre candidature`,
        text: [
            `Bonjour ${fullName},`,
            "",
            accepted
                ? "Bonne nouvelle : votre candidature a été acceptée. Vous allez recevoir vos identifiants de connexion dans un message séparé."
                : "Nous vous remercions pour l'intérêt porté à notre association. Après étude, nous ne pouvons pas donner une suite favorable à votre candidature pour le moment.",
            note ? `\nMessage de l'équipe : ${note}` : "",
        ].join("\n"),
    }, { kind: "application_decision" });

// paymentId (facultatif) : renseigne payments.receipt_sent_at quand l'email part reellement.
exports.sendDonationReceiptEmail = ({ to, fullName, amountLabel, receiptNumber, receiptUrl, pdfBuffer, paymentId }) =>
    send({
        to,
        subject: `${ORG_NAME} - Merci pour votre don (${receiptNumber})`,
        text: [
            `Bonjour ${fullName || ""},`.trim(),
            "",
            `Nous avons bien reçu votre don de ${amountLabel}. Merci infiniment pour votre générosité !`,
            `Votre reçu n° ${receiptNumber} est joint à ce message.`,
            receiptUrl ? `Vous pouvez aussi le télécharger ici : ${receiptUrl}` : "",
        ].join("\n"),
        attachments: pdfBuffer ? [{ filename: `recu-${receiptNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }] : undefined,
    }, { kind: "donation_receipt", paymentId });
