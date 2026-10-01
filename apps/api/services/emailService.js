const nodemailer = require("nodemailer");

const isProduction = process.env.NODE_ENV === "production";
const ORG_NAME = process.env.ORG_NAME || "HOPE International";

function hasMailConfig() {
    return Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_PORT &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
    );
}

let transporter;
function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: String(process.env.SMTP_SECURE || "false") === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    return transporter;
}

// Envoi generique. Sans SMTP, l'email est affiche dans la console en developpement
// (pratique pour tester les liens de reinitialisation) et simplement ignore en production.
async function send({ to, subject, text, attachments }) {
    if (!hasMailConfig()) {
        if (!isProduction) {
            console.log(`\n[email non envoyé - SMTP non configuré]\nÀ : ${to}\nObjet : ${subject}\n${text}\n`);
        }
        return { sent: false, reason: "smtp-not-configured" };
    }

    try {
        await getTransporter().sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            text,
            attachments,
        });
        return { sent: true };
    } catch (error) {
        console.error("email-error:", error.message);
        return { sent: false, reason: "smtp-error" };
    }
}

exports.hasMailConfig = hasMailConfig;
exports.send = send;

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
    });

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
    });

exports.sendApplicationReceivedEmail = ({ to, fullName }) =>
    send({
        to,
        subject: `${ORG_NAME} - Candidature bien reçue`,
        text: [
            `Bonjour ${fullName},`,
            "",
            `Merci pour votre candidature ! L'équipe ${ORG_NAME} va l'étudier et reviendra vers vous rapidement.`,
        ].join("\n"),
    });

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
    });

exports.sendDonationReceiptEmail = ({ to, fullName, amountLabel, receiptNumber, receiptUrl, pdfBuffer }) =>
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
        attachments: pdfBuffer ? [{ filename: `recu-${receiptNumber}.pdf`, content: pdfBuffer }] : undefined,
    });
