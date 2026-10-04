// Transport SMTP (nodemailer) partage par emailService (envoi immediat) et la file d'envoi.
const nodemailer = require("nodemailer");

// Delais courts : un SMTP injoignable ne doit pas bloquer une requete ni le worker.
const SMTP_TIMEOUT_MS = Number(process.env.SMTP_TIMEOUT_MS || 10000);

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
            connectionTimeout: SMTP_TIMEOUT_MS,
            greetingTimeout: SMTP_TIMEOUT_MS,
            socketTimeout: SMTP_TIMEOUT_MS,
        });
    }
    return transporter;
}

// Envoi effectif ; leve une erreur en cas d'echec.
async function deliver({ to, subject, text, attachments }) {
    await getTransporter().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        attachments,
    });
}

// Remplacement du transport (tests uniquement).
function setTransporterForTests(fake) {
    transporter = fake;
}

module.exports = { hasMailConfig, deliver, setTransporterForTests, SMTP_TIMEOUT_MS };
