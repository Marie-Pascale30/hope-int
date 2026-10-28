require("dotenv").config();

const { refuseInProduction, warnBeforeTruncate } = require("./guard");

// Jamais en production (comptes de demo aux mots de passe publics), sauf --force explicite.
refuseInProduction("npm run seed");

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { runMigrations } = require("../config/migrate");
const { photoUrl } = require("@hope/shared/photos");
const { importProjects, importNews, importTestimonials } = require("./content");

// Usage : npm run seed            -> complete la base si elle est vide
//         npm run seed -- --reset -> vide les donnees de demo puis les recree (avertissement,
//                                    5 s pour annuler ; --yes pour ne pas attendre)
//         --force                 -> autorise l'execution avec NODE_ENV=production
const RESET = process.argv.includes("--reset");

const MEMBERS = [
    { name: "Admin ONG", email: "admin@hope.org", password: "Admin@123456", roles: ["admin"], region: "Littoral", phone: "+237 6 90 00 00 01" },
    {
        name: "Martha Ndam",
        email: "directrice@hope.org",
        password: "Hope@123456",
        roles: ["directrice_generale", "secretaire_generale", "organisatrice"],
        region: "Littoral",
        phone: "+237 6 90 00 00 02",
    },
    { name: "Jean Biko", email: "conseiller@hope.org", password: "Hope@123456", roles: ["conseiller"], region: "Centre" },
    { name: "Claire Mbappe", email: "rh@hope.org", password: "Hope@123456", roles: ["responsable_rh"], region: "Centre", phone: "+237 6 90 00 00 04" },
    { name: "Daniel Kouam", email: "finance@hope.org", password: "Hope@123456", roles: ["responsable_finance"], region: "Littoral" },
    { name: "Lydie Njoya", email: "orga@hope.org", password: "Hope@123456", roles: ["organisatrice"], region: "Ouest" },
    {
        name: "Bryan Ndzi",
        email: "it@hope.org",
        password: "Hope@123456",
        roles: [
            "responsable_it", "directrice_generale", "conseiller", "responsable_rh", "responsable_finance",
            "organisatrice", "directrice_regionale", "secretaire_generale",
        ],
        region: "Centre",
    },
    { name: "Rita Nnanga", email: "region@hope.org", password: "Hope@123456", roles: ["directrice_regionale"], region: "Ouest", phone: "+237 6 90 00 00 08" },
    { name: "Pauline Ngono", email: "secretaire@hope.org", password: "Hope@123456", roles: ["secretaire_generale"], region: "Centre" },
    {
        name: "Alice Supporter", email: "alice@hope.org", password: "Member@123", roles: ["membre"], region: "Littoral",
        skills: "Comptabilité, animation d'ateliers", availability: "Samedis",
    },
    { name: "Brice Donor", email: "brice@hope.org", password: "Member@123", roles: ["membre"], region: "Centre" },
    {
        name: "Kevin Moukoko", email: "kevin@hope.org", password: "Member@123", roles: ["membre"], region: "Ouest",
        skills: "Agronomie", availability: "2 jours par mois",
    },
    { name: "Sandrine Tita", email: "sandrine@hope.org", password: "Member@123", roles: ["membre"], region: "Nord-Ouest" },
    // Compte invite (inscrit depuis le site, pas encore membre) : seul profil admis aux evenements benevoles.
    {
        name: "Grâce Ekane", email: "invite@hope.org", password: "Guest@123", roles: ["invite"], region: "Littoral",
        skills: "Animation d'enfants", availability: "Week-ends",
    },
];

async function upsertUser(person) {
    const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [person.email]);
    const values = [
        person.name, person.roles[0], JSON.stringify(person.roles), person.phone || null, person.region || null,
        person.skills || null, person.availability || null,
    ];
    if (rows.length) {
        await db.query(
            "UPDATE users SET name = ?, role = ?, roles = ?, phone = ?, region = ?, skills = ?, availability = ?, status = 'active' WHERE id = ?",
            [...values, rows[0].id]
        );
        // En reinitialisation, les dates d'inscription sont etalees sur l'annee (courbe de croissance realiste).
        if (RESET) {
            await db.query("UPDATE users SET created_at = DATE_SUB(NOW(), INTERVAL ? DAY) WHERE id = ?", [
                crypto.randomInt(5, 330),
                rows[0].id,
            ]);
        }
        return rows[0].id;
    }
    const hash = await bcrypt.hash(person.password, 12);
    const [result] = await db.query(
        `INSERT INTO users (name, role, roles, phone, region, skills, availability, email, password, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [...values, person.email, hash, crypto.randomInt(5, 330)]
    );
    return result.insertId;
}

async function isEmpty(table) {
    const [[row]] = await db.query(`SELECT COUNT(*) AS total FROM ${table}`);
    return Number(row.total) === 0;
}

const RESET_TABLES = ["event_registrations", "events", "payments", "news", "testimonials", "projects", "messages", "applications", "activity_logs"];

async function resetDemoData() {
    await warnBeforeTruncate(RESET_TABLES);
    await db.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of RESET_TABLES) {
        await db.query(`TRUNCATE TABLE ${table}`);
    }
    await db.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function seedEvents(projectIds, userIds, orgaId) {
    if (!(await isEmpty("events"))) return;
    const day = 86400000;
    const at = (days, hour) => {
        const date = new Date(Date.now() + days * day);
        date.setUTCHours(hour, 0, 0, 0);
        return date;
    };
    // Prochaine occurrence d'une date annuelle (journees internationales, Noel), heure UTC.
    const next = (month, dayOfMonth, hour) => {
        const now = new Date();
        const date = new Date(Date.UTC(now.getUTCFullYear(), month - 1, dayOfMonth, hour));
        if (date <= now) date.setUTCFullYear(date.getUTCFullYear() + 1);
        return date;
    };
    const plusHours = (date, hours) => new Date(date.getTime() + hours * 3600000);
    const aidsDay = next(12, 1, 8);
    const christmas = next(12, 20, 9);
    const events = [
        ["Préparation des colis de Noël", "Tri des dons, préparation des colis (vêtements, vivres, friandises, jouets) pour les orphelinats. Ouvert à tous les membres et bénévoles.", "Bonadibong, Akwa, Douala", "Littoral", at(9, 8), at(9, 13), 20, photoUrl("p14_05"), projectIds[2]],
        ["Collecte « Un vêtement = Un sourire »", "Stand de collecte de vêtements de tout genre pour les orphelinats, les camps de réfugiés et les prisons. Nous recherchons des bénévoles pour l'accueil du public.", "Akwa, Douala", "Littoral", at(16, 8), at(16, 17), 12, photoUrl("p10_01"), null],
        ["Journée mondiale de lutte contre le sida", "Campagne de sensibilisation du grand public aux modes de transmission et aux moyens de prévention du VIH.", "Douala", "Littoral", aidsDay, plusHours(aidsDay, 8), 15, photoUrl("p22_02"), projectIds[4]],
        ["Noël de l'espoir pour les orphelins", "La magie de Noël pour les orphelins : vêtements, repas, friandises, jouets et manège. Visite d'un orphelinat avec les membres de HOPE.", "Yaoundé", "Centre", christmas, plusHours(christmas, 7), 25, photoUrl("p14_11"), projectIds[2]],
        ["Assemblée générale ordinaire 2025", "Bilan moral, d'activités et financier de l'année, vote du budget prévisionnel, renouvellement du bureau, projets de l'année à venir et remise des distinctions.", "C'Nyanga, face à l'hôpital de district de Bonamoussadi, Douala", "Littoral", new Date("2025-12-14T13:00:00Z"), new Date("2025-12-14T17:00:00Z"), null, photoUrl("p04_02"), null],
    ];
    const ids = [];
    for (const event of events) {
        const [result] = await db.query(
            `INSERT INTO events (title, description, location, region, start_at, end_at, capacity, image_url, project_id, created_by, audience)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            // Assemblee generale : evenement interne, reserve aux membres.
            [...event, orgaId, event[0].startsWith("Assemblée générale") ? "members" : "volunteers"]
        );
        ids.push(result.insertId);
    }
    // Benevolat : le compte invite ; assemblee generale (dernier evenement) : des membres.
    const registrations = [[ids[0], userIds.invite], [ids[1], userIds.invite], [ids.at(-1), userIds.alice], [ids.at(-1), userIds.kevin], [ids.at(-1), userIds.brice]];
    await db.query("INSERT INTO event_registrations (event_id, user_id) VALUES ?", [registrations]);
}

async function seedMessagesAndApplications(assigneeId) {
    if (await isEmpty("messages")) {
        await db.query(
            "INSERT INTO messages (name, email, subject, content, status, assigned_to, created_at) VALUES ?",
            [[
                ["Aline N.", "aline@example.com", "Demande de partenariat", "Bonjour, notre entreprise souhaite parrainer la scolarité d'un enfant pour la prochaine rentrée. Comment procéder ?", "nouveau", null, new Date(Date.now() - 2 * 86400000)],
                ["David K.", "david@example.com", "Reçu pour mon don", "Bonjour, comment obtenir un reçu pour le don fait le mois dernier ?", "lu", assigneeId, new Date(Date.now() - 6 * 86400000)],
                ["Sara M.", "sara@example.com", "Bénévolat", "Je souhaite participer à la visite de Noël dans un orphelinat de Douala.", "traite", assigneeId, new Date(Date.now() - 20 * 86400000)],
            ]]
        );
    }

    if (await isEmpty("applications")) {
        await db.query(
            // Poles d'interet indicatifs (referentiel INTEREST_AREAS de @hope/shared).
            "INSERT INTO applications (name, email, phone, region, interests, motivation, status, created_at) VALUES ?",
            [[
                ["Nadine Fotso", "nadine@example.com", "+237 6 77 11 22 33", "Littoral", JSON.stringify(["terrain", "education"]),
                    "Je souhaite intégrer l'ONG en tant que bénévole terrain. J'ai animé des ateliers pour une association de quartier pendant trois ans.", "nouvelle", new Date(Date.now() - 1 * 86400000)],
                ["Paul Essomba", "paul@example.com", null, "Centre", JSON.stringify(["entrepreneuriat", "administration"]),
                    "Étudiant en économie, je voudrais aider à monter le futur programme de microcrédit solidaire et apprendre sur le terrain.", "en_etude", new Date(Date.now() - 5 * 86400000)],
            ]]
        );
    }
}

async function seedPayments(projectIds, userIds) {
    if (!(await isEmpty("payments"))) return;

    const donors = [
        { userId: userIds.alice, name: "Alice Supporter", email: "alice@hope.org" },
        { userId: userIds.brice, name: "Brice Donor", email: "brice@hope.org" },
        { userId: null, name: "Claire Dupont", email: "claire.dupont@example.com" },
        { userId: null, name: "Marc Lefèvre", email: "marc.lefevre@example.com" },
        { userId: null, name: "Awa Diallo", email: "awa.diallo@example.com" },
        { userId: userIds.kevin, name: "Kevin Moukoko", email: "kevin@hope.org" },
    ];
    const eurAmounts = [10, 20, 25, 30, 50, 50, 75, 100, 150, 200];
    const xafAmounts = [5000, 10000, 15000, 25000, 50000];

    const rows = [];
    // Dons reussis repartis sur les 12 derniers mois.
    for (let i = 0; i < 46; i += 1) {
        const donor = donors[i % donors.length];
        const mobile = i % 5 === 4;
        const daysAgo = Math.floor((i / 46) * 360) + crypto.randomInt(0, 6);
        rows.push({
            donor,
            amount: mobile ? xafAmounts[i % xafAmounts.length] : eurAmounts[(i * 7) % eurAmounts.length],
            currency: mobile ? "xaf" : "eur",
            method: mobile ? "mobile_money" : "card",
            provider: mobile ? "flutterwave" : "stripe",
            status: "succeeded",
            projectId: i % 4 === 3 ? null : projectIds[i % 3],
            frequency: donor.userId === userIds.alice && !mobile ? "monthly" : "once",
            date: new Date(Date.now() - daysAgo * 86400000),
        });
    }
    // Quelques paiements en attente / echoues pour le suivi financier.
    rows.push({ donor: donors[3], amount: 40, currency: "eur", method: "card", provider: "stripe", status: "pending", projectId: projectIds[0], frequency: "once", date: new Date(Date.now() - 3 * 3600000) });
    rows.push({ donor: donors[4], amount: 20000, currency: "xaf", method: "mobile_money", provider: "flutterwave", status: "failed", projectId: projectIds[2], frequency: "once", date: new Date(Date.now() - 8 * 86400000) });

    rows.sort((a, b) => a.date - b.date);
    const counters = {};
    for (const row of rows) {
        const year = row.date.getUTCFullYear();
        let receiptNumber = null;
        if (row.status === "succeeded") {
            counters[year] = (counters[year] || 0) + 1;
            receiptNumber = `HOPE-${year}-${String(counters[year]).padStart(6, "0")}`;
        }
        await db.query(
            `INSERT INTO payments
               (user_id, amount, currency, method, provider, status, transaction_id, donor_name, donor_email, project_id,
                frequency, subscription_id, receipt_number, receipt_token, paid_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                row.donor.userId, row.amount, row.currency, row.method, row.provider, row.status,
                `${row.provider === "stripe" ? "pi_demo" : "HOPE-demo"}_${crypto.randomBytes(6).toString("hex")}`,
                row.donor.name, row.donor.email, row.projectId, row.frequency,
                row.frequency === "monthly" ? "sub_demoAliceMonthly" : null,
                receiptNumber, crypto.randomBytes(24).toString("hex"),
                row.status === "succeeded" ? row.date : null, row.date,
            ]
        );
    }
}

async function seedLogs(adminId) {
    if (!(await isEmpty("activity_logs"))) return;
    await db.query(
        `INSERT INTO activity_logs (user_id, action, meta) VALUES
          (?, 'seed.initialized', JSON_OBJECT('source', 'seed-script')),
          (?, 'auth.login', JSON_OBJECT('email', 'admin@hope.org'))`,
        [adminId, adminId]
    );
}

async function main() {
    try {
        await runMigrations();
        if (RESET) {
            await resetDemoData();
            console.log("Données de démo réinitialisées.");
        }

        const ids = {};
        for (const person of MEMBERS) {
            ids[person.email] = await upsertUser(person);
        }
        const userIds = {
            alice: ids["alice@hope.org"],
            brice: ids["brice@hope.org"],
            kevin: ids["kevin@hope.org"],
            invite: ids["invite@hope.org"],
        };

        // Contenu reel (partage avec import-content.js) ; en developpement, le texte des actualites est remis a jour.
        const { ids: projectIds } = await importProjects(db);
        await importNews(db, projectIds, { update: true });
        await importTestimonials(db, projectIds);
        await seedEvents(projectIds, userIds, ids["orga@hope.org"]);
        await seedMessagesAndApplications(ids["secretaire@hope.org"]);
        await seedPayments(projectIds, userIds);
        await seedLogs(ids["admin@hope.org"]);

        console.log("Seed terminé avec succès.");
        console.log("Admin : admin@hope.org / Admin@123456");
        console.log("Équipe : directrice@, rh@, finance@, orga@, it@, region@, secretaire@hope.org / Hope@123456");
        console.log("Membres : alice@, brice@, kevin@, sandrine@hope.org / Member@123");
        console.log("Invité (bénévole) : invite@hope.org / Guest@123");
    } catch (error) {
        console.error("Erreur seed:", error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

main();
