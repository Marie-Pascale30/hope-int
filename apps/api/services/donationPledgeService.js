// Don mensuel par Mobile Money (engagement) : le donateur s'engage sur un montant en FCFA et un
// jour du mois ; chaque mois, un rappel lui envoie un lien de paiement pre-rempli (et un lien
// WhatsApp a copier). Les dons faits avec ce lien sont rattaches a l'engagement (payments.pledge_id),
// ce qui permet le suivi de regularite (echeances payees / manquees). Gestion depuis l'espace
// membre ou, sans compte, par un lien secret envoye par email.
const pledgeRepo = require("../repositories/donationPledgeRepository");
const contentRepo = require("../repositories/contentRepository");
const emailService = require("./emailService");
const preferences = require("./preferences");
const logService = require("./activityLogService");
const receiptFormat = require("./receiptFormat");
const { singleLine } = require("./donationExtras");
const { PLEDGE_DAY_RANGE, PLEDGE_STATUSES, SOURCES } = require("@hope/shared/fundraising");
const { DONATION_LIMITS } = require("@hope/shared/constants");
const { dateParts, monthKey } = require("../utils/timezone");
const { badRequest, notFound } = require("../utils/httpError");
const { getScopeRegion } = require("../utils/scope");
const { FRONTEND_URL, randomToken, sha256 } = require("../utils/security");

const ORG_NAME = process.env.ORG_NAME || "HOPE International Project";
const CURRENCY = "xaf";
const BATCH = 100;

// Periode courante ("AAAA-MM") et jour du mois dans le fuseau des recus.
function today(now = new Date()) {
    return { period: monthKey(now), day: Number(dateParts(now).day) };
}

function payUrl(pledge) {
    const params = new URLSearchParams({
        montant: String(Math.round(pledge.amount)),
        devise: CURRENCY,
        moyen: "mobile_money",
        engagement: pledge.pay_ref,
        ref: SOURCES.pledge,
    });
    if (pledge.project_id) params.set("projet", String(pledge.project_id));
    return `${FRONTEND_URL}/don?${params.toString()}`;
}

const manageUrl = (token) => `${FRONTEND_URL}/collecte/engagement/${token}`;

function whatsappUrl(pledge) {
    const amount = receiptFormat.formatAmount(pledge.amount, CURRENCY);
    return `https://wa.me/?text=${encodeURIComponent(`Mon don mensuel à ${ORG_NAME} (${amount}) : ${payUrl(pledge)}`)}`;
}

// Regularite : chaque mois rappele est une echeance ; payee si un don confirme rattache a
// l'engagement a ete fait ce mois-la, manquee si le mois est passe sans don, en cours sinon.
function regularity(pledge, reminders, payments, now = new Date()) {
    const current = monthKey(now);
    const paidMonths = new Set(payments.map((payment) => monthKey(payment.paid_at)));
    const periods = [...new Set([...reminders.map((row) => row.period), ...paidMonths])].sort();
    const items = periods.map((period) => ({
        period,
        status: paidMonths.has(period) ? "paid" : period < current ? "missed" : "due",
    }));
    const paid = items.filter((item) => item.status === "paid").length;
    const missed = items.filter((item) => item.status === "missed").length;
    return {
        periods: items.slice(-12),
        paid,
        missed,
        rate: paid + missed ? Math.round((paid / (paid + missed)) * 100) : null,
        totalPaid: payments.reduce((sum, payment) => sum + payment.amount, 0),
    };
}

async function withRegularity(pledges, now = new Date()) {
    const ids = pledges.map((pledge) => pledge.id);
    const [reminders, payments] = await Promise.all([pledgeRepo.getReminderPeriods(ids), pledgeRepo.getPaidDonations(ids)]);
    return pledges.map((pledge) => ({
        ...toView(pledge),
        regularity: regularity(
            pledge,
            reminders.filter((row) => row.pledge_id === pledge.id),
            payments.filter((row) => row.pledge_id === pledge.id),
            now
        ),
    }));
}

function toView(pledge) {
    return {
        id: pledge.id,
        amount: pledge.amount,
        currency: pledge.currency,
        day_of_month: pledge.day_of_month,
        project_id: pledge.project_id,
        project_title: pledge.project_title || null,
        status: pledge.status,
        channel: pledge.channel,
        donor_name: pledge.donor_name,
        created_at: pledge.created_at,
        stopped_at: pledge.stopped_at,
        last_reminder_at: pledge.last_reminder_at,
        pay_url: pledge.status === "stopped" ? null : payUrl(pledge),
        whatsapp_url: pledge.status === "stopped" ? null : whatsappUrl(pledge),
    };
}

function checkAmount(value) {
    const amount = Math.round(Number(value));
    const { min, max } = DONATION_LIMITS[CURRENCY];
    if (!(amount >= min && amount <= max)) throw badRequest(`Le montant doit être compris entre ${min} et ${max} XAF`);
    return amount;
}

function checkDay(value) {
    const day = Number(value);
    if (!Number.isInteger(day) || day < PLEDGE_DAY_RANGE.min || day > PLEDGE_DAY_RANGE.max) {
        throw badRequest("Choisissez un jour du mois entre 1 et 28");
    }
    return day;
}

async function checkProject(projectId) {
    if (!projectId) return null;
    const project = await contentRepo.getById("projects", Number(projectId), { publishedOnly: true });
    if (!project) throw badRequest("Projet introuvable");
    if (project.status === "termine") throw badRequest("Ce projet est terminé : il ne reçoit plus de dons");
    return project.id;
}

function confirmationEmail(pledge, token) {
    const amount = receiptFormat.formatAmount(pledge.amount, CURRENCY);
    return {
        subject: `${ORG_NAME} - Votre don mensuel Mobile Money`,
        text: [
            `Bonjour ${pledge.donor_name},`,
            "",
            `Merci pour votre engagement : ${amount} chaque mois${pledge.project_title ? ` pour « ${pledge.project_title} »` : ""}.`,
            `Chaque mois, autour du ${pledge.day_of_month}, nous vous enverrons un rappel avec un lien de paiement déjà rempli.`,
            "",
            `Faire le don de ce mois-ci : ${payUrl(pledge)}`,
            "",
            token ? `Modifier, suspendre ou arrêter votre engagement à tout moment : ${manageUrl(token)}` : "Vous pouvez modifier, suspendre ou arrêter votre engagement depuis votre espace membre.",
            "Conservez ce message : ce lien est personnel.",
            "",
            `L'équipe ${ORG_NAME}`,
        ].join("\n"),
    };
}

exports.create = async (user, input) => {
    const amount = checkAmount(input.amount);
    const dayOfMonth = checkDay(input.dayOfMonth);
    const projectId = await checkProject(input.projectId);
    const donorName = user?.name || singleLine(input.donorName, 150);
    const donorEmail = user?.email || String(input.donorEmail || "").trim().toLowerCase();
    if (donorName.length < 2 || !donorEmail) throw badRequest("Nom et email du donateur obligatoires");

    const token = randomToken(24);
    const id = await pledgeRepo.create({
        userId: user?.id,
        donorName,
        donorEmail,
        amount,
        currency: CURRENCY,
        dayOfMonth,
        projectId,
        manageTokenHash: sha256(token),
        payRef: randomToken(12),
    });
    // Le mois de l'inscription est couvert par l'email de confirmation (lien de paiement) : le
    // premier rappel part le mois suivant.
    await pledgeRepo.claimReminder(id, today().period);
    const pledge = await pledgeRepo.findById(id);
    const message = confirmationEmail(pledge, token);
    await emailService.send({ to: donorEmail, subject: message.subject, text: message.text });
    await logService.log({ userId: user?.id || null, action: "donation.pledge_created", meta: { pledgeId: id, amount, dayOfMonth } });
    const [view] = await withRegularity([pledge]);
    return { pledge: view, manageToken: token };
};

exports.getMine = async (user) => withRegularity(await pledgeRepo.getByUser(user.id));

async function applyChanges(pledge, input, actorId, source) {
    if (pledge.status === "stopped") throw badRequest("Cet engagement est arrêté");
    const changes = {};
    if (input.amount !== undefined) changes.amount = checkAmount(input.amount);
    if (input.dayOfMonth !== undefined) changes.dayOfMonth = checkDay(input.dayOfMonth);
    if (input.projectId !== undefined) changes.projectId = await checkProject(input.projectId);
    if (input.status !== undefined) {
        if (!PLEDGE_STATUSES.includes(input.status)) throw badRequest("Statut d'engagement invalide");
        changes.status = input.status;
    }
    await pledgeRepo.update(pledge.id, changes);
    await logService.log({
        userId: actorId || null,
        action: changes.status === "stopped" ? "donation.pledge_stopped" : "donation.pledge_updated",
        meta: { pledgeId: pledge.id, changes, source },
    });
    const [view] = await withRegularity([await pledgeRepo.findById(pledge.id)]);
    return view;
}

exports.updateMine = async (user, id, input) => {
    const pledge = await pledgeRepo.findById(id);
    if (!pledge || pledge.user_id !== user.id) throw notFound("Engagement introuvable");
    return applyChanges(pledge, input, user.id, "account");
};

async function findByToken(token) {
    const pledge = await pledgeRepo.findByTokenHash(sha256(String(token)));
    if (!pledge) throw notFound("Engagement introuvable");
    return pledge;
}

exports.getByToken = async (token) => {
    const [view] = await withRegularity([await findByToken(token)]);
    return view;
};

exports.updateByToken = async (token, input) => {
    const pledge = await findByToken(token);
    return applyChanges(pledge, input, pledge.user_id, "token");
};

exports.list = async (actor, { status } = {}) => {
    const region = getScopeRegion(actor);
    const pledges = await pledgeRepo.getAll({ status, ...(region ? { region } : {}) });
    return (await withRegularity(pledges)).map((view, index) => ({ ...view, donor_email: pledges[index].donor_email }));
};

function reminderEmail(pledge) {
    const amount = receiptFormat.formatAmount(pledge.amount, CURRENCY);
    return {
        subject: `${ORG_NAME} - Votre don mensuel de ${amount}`,
        text: [
            `Bonjour ${pledge.donor_name},`,
            "",
            `C'est le moment de votre don mensuel de ${amount}${pledge.project_title ? ` pour « ${pledge.project_title} »` : ""}. Merci pour votre fidélité !`,
            "",
            `Payer par Mobile Money (lien déjà rempli) : ${payUrl(pledge)}`,
            "",
            `Pour payer depuis votre téléphone, envoyez-vous ce lien sur WhatsApp : ${whatsappUrl(pledge)}`,
            "",
            "Pour suspendre ou arrêter votre engagement : votre espace membre, ou le lien de gestion reçu lors de votre inscription.",
            `L'équipe ${ORG_NAME}`,
        ].join("\n"),
    };
}

// Rappels du mois : engagements actifs dont le jour est atteint (consentement "donation_reminders").
exports.runReminders = async ({ now = new Date(), limit = BATCH } = {}) => {
    const { period, day } = today(now);
    const due = await pledgeRepo.getDue({ period, day, limit });
    const summary = { checked: due.length, sent: 0, skipped: 0 };
    for (const pledge of due) {
        // Sans consentement : aucun rappel ni echeance comptee (nouvelle verification au passage suivant).
        if (!(await preferences.canContact(pledge.donor_email, "donation_reminders"))) {
            summary.skipped += 1;
            continue;
        }
        if (!(await pledgeRepo.claimReminder(pledge.id, period))) continue;
        const message = reminderEmail(pledge);
        const footer = await preferences.unsubscribeFooter(pledge.donor_email, "donation_reminders");
        await emailService.send({ to: pledge.donor_email, subject: message.subject, text: footer ? `${message.text}\n\n${footer}` : message.text });
        summary.sent += 1;
    }
    if (summary.sent) await logService.log({ action: "donation.pledge_reminders", meta: { period, ...summary } });
    return summary;
};

exports.regularity = regularity;
exports.payUrl = payUrl;
