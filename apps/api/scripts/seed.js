require("dotenv").config();

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { runMigrations } = require("../config/migrate");

// Usage : npm run seed            -> complete la base si elle est vide
//         npm run seed -- --reset -> vide les donnees de demo puis les recree
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
];

const PROJECTS = [
    {
        title: "Microcrédit pour femmes rurales",
        summary: "Financer et accompagner 120 micro-activités portées par des femmes dans l'Ouest.",
        description: "Nous octroyons des microcrédits à taux solidaire à des groupements de femmes rurales, accompagnés d'une formation en gestion et d'un suivi mensuel par nos agents de terrain. Chaque prêt remboursé est réinvesti dans une nouvelle activité : commerce de proximité, transformation agricole, couture ou élevage.\n\nL'objectif de la campagne 2026 est d'élargir le programme à trois nouveaux villages autour de Bafoussam.",
        image_url: "/images/projects/microcredit.svg",
        status: "en_cours", region: "Ouest", start_date: "2025-03-01", end_date: "2026-12-31",
        budget: 45000, goal_amount: 15000, beneficiaries: 480, trainees: 120, credits_granted: 96,
    },
    {
        title: "Éducation entrepreneuriale des jeunes",
        summary: "Un parcours de 6 mois pour former de jeunes entrepreneurs sociaux à Douala.",
        description: "Ateliers hebdomadaires, mentorat par des entrepreneurs confirmés et accès à un fonds d'amorçage : le programme accompagne chaque année une promotion de 40 jeunes de 18 à 30 ans, de l'idée jusqu'au lancement de leur activité.",
        image_url: "/images/projects/formation.svg",
        status: "en_cours", region: "Littoral", start_date: "2025-09-01", end_date: "2026-08-31",
        budget: 28000, goal_amount: 10000, beneficiaries: 160, trainees: 80, credits_granted: 24,
    },
    {
        title: "Groupes solidaires agricoles",
        summary: "Structurer des coopératives agricoles pour mieux vendre les récoltes.",
        description: "Nous aidons les petits producteurs à se regrouper en coopératives : achat groupé de semences, stockage partagé et accès direct aux marchés urbains. Les membres suivent une formation aux techniques agroécologiques.",
        image_url: "/images/projects/agriculture.svg",
        status: "en_cours", region: "Nord-Ouest", start_date: "2025-01-15", end_date: null,
        budget: 32000, goal_amount: 12000, beneficiaries: 350, trainees: 140, credits_granted: 40,
    },
    {
        title: "Accès à l'eau potable à Garoua",
        summary: "Forage et gestion communautaire de 4 points d'eau.",
        description: "Construction de quatre forages équipés de pompes solaires, gérés par des comités d'usagers formés à la maintenance. Le projet est terminé et les comités assurent désormais la gestion de manière autonome.",
        image_url: "/images/projects/eau.svg",
        status: "termine", region: "Nord", start_date: "2024-02-01", end_date: "2025-06-30",
        budget: 38000, goal_amount: null, beneficiaries: 2200, trainees: 24, credits_granted: 0,
    },
    {
        title: "Épargne et santé des familles",
        summary: "Une mutuelle d'épargne pour faire face aux dépenses de santé.",
        description: "En cours de lancement : des caisses d'épargne villageoises couplées à une micro-assurance santé, pour éviter que les familles ne s'endettent lors d'un problème de santé.",
        image_url: "/images/projects/sante.svg",
        status: "planifie", region: "Centre", start_date: "2026-11-01", end_date: null,
        budget: 20000, goal_amount: 8000, beneficiaries: 0, trainees: 0, credits_granted: 0,
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

async function resetDemoData() {
    await db.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of ["event_registrations", "events", "payments", "news", "testimonials", "projects", "messages", "applications", "activity_logs"]) {
        await db.query(`TRUNCATE TABLE ${table}`);
    }
    await db.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function seedProjects() {
    if (!(await isEmpty("projects"))) {
        const [rows] = await db.query("SELECT id FROM projects ORDER BY id");
        return rows.map((row) => row.id);
    }
    const ids = [];
    for (const project of PROJECTS) {
        const [result] = await db.query("INSERT INTO projects SET ?", [project]);
        ids.push(result.insertId);
    }
    return ids;
}

async function seedNewsAndTestimonials(projectIds) {
    if (await isEmpty("news")) {
        await db.query(
            `INSERT INTO news (title, summary, content, image_url, project_id, created_at) VALUES ?`,
            [[
                ["Lancement de la campagne 2026", "Objectif : 500 familles accompagnées d'ici la fin de l'année.",
                    "Notre nouvelle campagne de collecte finance l'extension du programme de microcrédit à trois nouveaux villages de l'Ouest et une nouvelle promotion de jeunes entrepreneurs à Douala. Chaque don, même modeste, compte.",
                    "/images/news/campagne.svg", projectIds[0], new Date(Date.now() - 12 * 86400000)],
                ["Un nouveau centre de formation à Douala", "Un lieu d'accueil, de formation et de mentorat ouvre à Bonabéri.",
                    "Le centre accueille désormais les ateliers du programme d'éducation entrepreneuriale ainsi que les permanences de nos conseillers. Il est ouvert du lundi au samedi.",
                    "/images/news/centre.svg", projectIds[1], new Date(Date.now() - 40 * 86400000)],
                ["Les forages de Garoua gérés par les habitants", "Un an après, les comités d'usagers sont autonomes.",
                    "Les quatre points d'eau construits en 2024 fonctionnent sans interruption. Les comités formés par HOPE assurent l'entretien et la collecte d'une petite cotisation pour les réparations.",
                    "/images/projects/eau.svg", projectIds[3], new Date(Date.now() - 75 * 86400000)],
            ]]
        );
    }

    if (await isEmpty("testimonials")) {
        await db.query(
            "INSERT INTO testimonials (author, role_label, content, project_id) VALUES ?",
            [[
                ["Mireille T.", "Commerçante, Bafoussam", "Grâce à HOPE, j'ai lancé mon commerce de vivres et je finance l'école de mes trois enfants. Le suivi mensuel m'a appris à tenir mes comptes.", projectIds[0]],
                ["Joël A.", "Président de coopérative", "Le suivi des mentors nous a aidés à structurer notre coopérative : nous vendons maintenant directement aux marchés de Bamenda.", projectIds[2]],
                ["Estelle K.", "Promotion 2025, Douala", "Le programme m'a donné la méthode et la confiance pour créer mon atelier de couture. J'emploie aujourd'hui deux apprenties.", projectIds[1]],
            ]]
        );
    }
}

async function seedEvents(projectIds, userIds, orgaId) {
    if (!(await isEmpty("events"))) return;
    const day = 86400000;
    const at = (days, hour) => {
        const date = new Date(Date.now() + days * day);
        date.setUTCHours(hour, 0, 0, 0);
        return date;
    };
    const events = [
        ["Atelier gestion et comptabilité", "Une matinée pour apprendre à tenir un cahier de caisse et calculer sa marge. Ouvert aux bénéficiaires et aux bénévoles.", "Centre HOPE, Bonabéri, Douala", "Littoral", at(9, 8), at(9, 12), 25, "/images/events/atelier.svg", projectIds[1]],
        ["Journée de collecte solidaire", "Stand d'information et de collecte au marché central. Nous recherchons des bénévoles pour l'accueil du public.", "Marché central, Bafoussam", "Ouest", at(16, 7), at(16, 17), 12, "/images/events/collecte.svg", projectIds[0]],
        ["Visite des coopératives agricoles", "Rencontre avec les groupes solidaires et visite des parcelles en agroécologie.", "Ndop, Nord-Ouest", "Nord-Ouest", at(30, 6), at(30, 15), 8, "/images/projects/agriculture.svg", projectIds[2]],
        ["Assemblée générale annuelle", "Bilan de l'année, présentation des comptes et des projets à venir. Ouverte à tous les membres.", "Salle des fêtes, Yaoundé", "Centre", at(45, 13), at(45, 17), null, "/images/news/centre.svg", null],
        ["Formation des comités d'eau", "Session de formation à la maintenance des pompes solaires.", "Garoua", "Nord", at(-60, 8), at(-60, 16), 20, "/images/projects/eau.svg", projectIds[3]],
    ];
    const ids = [];
    for (const event of events) {
        const [result] = await db.query(
            `INSERT INTO events (title, description, location, region, start_at, end_at, capacity, image_url, project_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [...event, orgaId]
        );
        ids.push(result.insertId);
    }
    const registrations = [[ids[0], userIds.alice], [ids[0], userIds.brice], [ids[1], userIds.kevin], [ids[1], userIds.alice], [ids[4], userIds.kevin]];
    await db.query("INSERT INTO event_registrations (event_id, user_id) VALUES ?", [registrations]);
}

async function seedMessagesAndApplications(assigneeId) {
    if (await isEmpty("messages")) {
        await db.query(
            "INSERT INTO messages (name, email, subject, content, status, assigned_to, created_at) VALUES ?",
            [[
                ["Aline N.", "aline@example.com", "Demande de partenariat", "Bonjour, notre entreprise souhaite parrainer un groupe de femmes du programme de microcrédit. Comment procéder ?", "nouveau", null, new Date(Date.now() - 2 * 86400000)],
                ["David K.", "david@example.com", "Reçu pour mon don", "Bonjour, comment obtenir un reçu pour le don fait le mois dernier ?", "lu", assigneeId, new Date(Date.now() - 6 * 86400000)],
                ["Sara M.", "sara@example.com", "Bénévolat", "Je souhaite rejoindre les actions terrain de HOPE à Douala le week-end.", "traite", assigneeId, new Date(Date.now() - 20 * 86400000)],
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
                    "Étudiant en économie, je voudrais contribuer au suivi des microcrédits et apprendre sur le terrain.", "en_etude", new Date(Date.now() - 5 * 86400000)],
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
        };

        const projectIds = await seedProjects();
        await seedNewsAndTestimonials(projectIds);
        await seedEvents(projectIds, userIds, ids["orga@hope.org"]);
        await seedMessagesAndApplications(ids["secretaire@hope.org"]);
        await seedPayments(projectIds, userIds);
        await seedLogs(ids["admin@hope.org"]);

        console.log("Seed terminé avec succès.");
        console.log("Admin : admin@hope.org / Admin@123456");
        console.log("Équipe : directrice@, rh@, finance@, orga@, it@, region@, secretaire@hope.org / Hope@123456");
        console.log("Membres : alice@, brice@, kevin@, sandrine@hope.org / Member@123");
    } catch (error) {
        console.error("Erreur seed:", error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

main();
