require("dotenv").config();

const { refuseInProduction } = require("./guard");

// Donnees de demonstration VOLUMINEUSES (tableaux de bord, pagination, rapports, performances).
// Complementaire de `npm run seed` (comptes de demo et contenus) : a lancer apres lui.
//
//   npm run seed:demo -w @hope/api                 echelle 1 (~200 membres, ~2 000 dons)
//   npm run seed:demo -w @hope/api -- --scale=5    5 fois plus
//   options : --seed=42 (generateur deterministe), --force (autorise NODE_ENV=production : a eviter)
//
// Les membres generes ont une adresse @demo.hope.test (mot de passe Member@123) : relancer le
// script ajoute de nouveaux dons, evenements et candidatures mais reutilise les memes membres.
// N'utilise que les colonnes des migrations 001 a 003 (004 en option, si presente).
refuseInProduction("npm run seed:demo");

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { runMigrations } = require("../config/migrate");
const { columnExists } = require("../config/schema");
const { REGIONS } = require("@hope/shared/constants");
const { INTEREST_VALUES } = require("@hope/shared/applications");

const DEMO_DOMAIN = "demo.hope.test";
const DAY = 86400000;

function argValue(name, fallback) {
    const arg = process.argv.find((value) => value.startsWith(`--${name}=`));
    return arg ? arg.slice(name.length + 3) : fallback;
}

const SCALE = Math.max(0.1, Number(argValue("scale", "1")) || 1);
const SEED = Number(argValue("seed", "20260101")) || 1;

// Generateur pseudo-aleatoire deterministe (mulberry32) : memes donnees pour la meme graine.
let state = SEED >>> 0;
function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (list) => list[Math.floor(random() * list.length)];
const chance = (probability) => random() < probability;
const daysAgo = (days) => new Date(Date.now() - days * DAY - int(0, DAY - 1));
const token = (bytes) => crypto.randomBytes(bytes).toString("hex");

const FIRST_NAMES = [
    "Aïcha", "Bertrand", "Carine", "Didier", "Estelle", "Fabrice", "Grâce", "Hervé", "Inès", "Jules", "Karelle", "Landry",
    "Mireille", "Nadège", "Olivier", "Patricia", "Quentin", "Rosine", "Serge", "Tatiana", "Ulrich", "Vanessa", "William", "Yvette",
];
const LAST_NAMES = [
    "Abena", "Bella", "Chendjou", "Djoumessi", "Ekotto", "Fouda", "Kamga", "Mbarga", "Ndjock", "Nkoulou", "Owona", "Tchoua",
    "Wandji", "Yimga", "Zambo", "Etoundi", "Manga", "Ngo Bayang", "Simo", "Talla",
];
const SKILLS = ["Comptabilité", "Animation", "Agronomie", "Informatique", "Communication", "Logistique", "Santé communautaire", null];
const EUR_AMOUNTS = [5, 10, 15, 20, 25, 30, 50, 50, 75, 100, 150, 200, 500];
const XAF_AMOUNTS = [1000, 2000, 5000, 5000, 10000, 15000, 25000, 50000, 100000];

async function insertMany(table, columns, rows, chunkSize = 500) {
    let firstId = null;
    for (let index = 0; index < rows.length; index += chunkSize) {
        const chunk = rows.slice(index, index + chunkSize);
        const [result] = await db.query(`INSERT INTO ${table} (${columns.join(", ")}) VALUES ?`, [chunk]);
        if (firstId === null) firstId = result.insertId;
    }
    return firstId;
}

// ---------- Membres ----------

async function seedMembers(count) {
    const hash = await bcrypt.hash("Member@123", 10);
    const rows = [];
    for (let n = 1; n <= count; n += 1) {
        const first = pick(FIRST_NAMES);
        const last = pick(LAST_NAMES);
        const email = `${first}.${last}.${n}`
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/\s+/g, "")
            .toLowerCase();
        rows.push([
            `${first} ${last}`,
            `${email}@${DEMO_DOMAIN}`,
            hash,
            "membre",
            JSON.stringify(["membre"]),
            `+2376${int(50, 99)}${String(int(0, 999999)).padStart(6, "0")}`,
            REGIONS[(n - 1) % REGIONS.length], // repartition sur les 10 regions
            pick(SKILLS),
            chance(0.06) ? "inactive" : "active",
            daysAgo(int(1, 3 * 365)),
        ]);
    }
    for (let index = 0; index < rows.length; index += 500) {
        await db.query(
            `INSERT IGNORE INTO users (name, email, password, role, roles, phone, region, skills, status, created_at) VALUES ?`,
            [rows.slice(index, index + 500)]
        );
    }
    const [members] = await db.query("SELECT id, name, email, region FROM users WHERE email LIKE ? ORDER BY id", [`%@${DEMO_DOMAIN}`]);
    return members;
}

// ---------- Projets ----------

async function ensureProjects() {
    const [existing] = await db.query("SELECT id, title, region FROM projects ORDER BY id");
    if (existing.length >= 3) return existing;
    const rows = REGIONS.slice(0, 6).map((region, index) => [
        `Programme solidaire ${region}`,
        `Projet de demonstration (${region}).`,
        `Projet genere par seed-demo pour la region ${region}.`,
        index % 3 === 2 ? "termine" : "en_cours",
        region,
        int(10000, 60000),
        index % 3 === 2 ? null : int(5000, 20000),
        int(50, 900),
    ]);
    await insertMany("projects", ["title", "summary", "description", "status", "region", "budget", "goal_amount", "beneficiaries"], rows);
    const [projects] = await db.query("SELECT id, title, region FROM projects ORDER BY id");
    return projects;
}

// ---------- Dons ----------

// Numeros de recu consecutifs par annee, a la suite de receipt_sequences (jamais de doublon).
async function receiptAllocator() {
    const [rows] = await db.query("SELECT year, last_number FROM receipt_sequences");
    const counters = Object.fromEntries(rows.map((row) => [row.year, Number(row.last_number)]));
    return {
        next(date) {
            const year = date.getUTCFullYear();
            counters[year] = (counters[year] || 0) + 1;
            return `HOPE-${year}-${String(counters[year]).padStart(6, "0")}`;
        },
        async save() {
            for (const [year, last] of Object.entries(counters)) {
                await db.query(
                    `INSERT INTO receipt_sequences (year, last_number) VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE last_number = GREATEST(last_number, VALUES(last_number))`,
                    [Number(year), last]
                );
            }
        },
    };
}

function donationStatus() {
    const roll = random();
    if (roll < 0.8) return "succeeded";
    if (roll < 0.85) return "refunded";
    if (roll < 0.88) return "review";
    if (roll < 0.92) return "pending";
    if (roll < 0.97) return "failed";
    if (roll < 0.99) return "canceled";
    return "disputed";
}

function buildPayment({ donor, projects, date, status, frequency = "once", subscription = null, card = null }) {
    const isCard = card ?? chance(0.6);
    const currency = isCard ? "eur" : "xaf";
    const amount = isCard ? pick(EUR_AMOUNTS) : pick(XAF_AMOUNTS);
    const provider = isCard ? "stripe" : chance(0.7) ? "notchpay" : "flutterwave";
    const project = chance(0.25) ? null : pick(projects);
    const partialRefund = status === "succeeded" && chance(0.02);
    return {
        user_id: donor.id ?? null,
        amount,
        currency,
        method: isCard ? "card" : "mobile_money",
        provider,
        status,
        transaction_id: `${isCard ? "pi_demo" : "HOPE-demo"}_${token(8)}`,
        donor_name: donor.name,
        donor_email: donor.email,
        project_id: project ? project.id : null,
        frequency,
        subscription_id: subscription?.id ?? null,
        subscription_status: subscription?.status ?? null,
        refunded_amount: status === "refunded" ? amount : partialRefund ? Math.round(amount * 0.5 * 100) / 100 : 0,
        refunded_at: status === "refunded" || partialRefund ? new Date(date.getTime() + int(1, 20) * DAY) : null,
        paid_at: ["succeeded", "refunded", "disputed", "review"].includes(status) ? date : null,
        created_at: date,
        projectTitle: project ? project.title : null,
    };
}

async function seedPayments(members, projects, count) {
    const receipts = await receiptAllocator();
    const anonymous = Array.from({ length: Math.ceil(count / 10) }, (_, n) => ({
        id: null,
        name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
        email: `donateur.${n + 1}.${token(3)}@example.org`,
    }));
    const payments = [];

    // Dons ponctuels sur 3 ans (plus nombreux recemment).
    for (let n = 0; n < count; n += 1) {
        const donor = chance(0.55) ? pick(members) : pick(anonymous);
        const age = Math.floor(Math.pow(random(), 1.3) * 3 * 365);
        payments.push(buildPayment({ donor, projects, date: daysAgo(age), status: donationStatus() }));
    }

    // Dons mensuels par carte : une serie de prelevements par abonne.
    const subscribers = members.filter(() => chance(0.08));
    for (const donor of subscribers) {
        const months = int(2, 30);
        const canceled = chance(0.3);
        const subscription = { id: `sub_demo_${token(6)}`, status: canceled ? "canceled" : chance(0.1) ? "past_due" : "active" };
        const start = int(months * 30, Math.min(3 * 365, months * 30 + 120));
        for (let month = 0; month < months; month += 1) {
            const status = month === months - 1 && subscription.status === "past_due" ? "failed" : "succeeded";
            payments.push(
                buildPayment({ donor, projects, date: daysAgo(Math.max(0, start - month * 30)), status, frequency: "monthly", subscription, card: true })
            );
        }
    }

    payments.sort((a, b) => a.created_at - b.created_at);
    const hasPeriodEnd = await columnExists("payments", "subscription_period_end"); // migration 004 (optionnelle)
    const columns = [
        "user_id", "amount", "currency", "method", "provider", "status", "transaction_id", "donor_name", "donor_email",
        "project_id", "frequency", "subscription_id", "subscription_status", "refunded_amount", "refunded_at",
        "receipt_number", "receipt_token", "receipt_issued_at", "receipt_donor_name", "receipt_donor_email",
        "receipt_designation", "receipt_amount", "receipt_currency", "receipt_method", "receipt_frequency",
        "paid_at", "created_at",
        ...(hasPeriodEnd ? ["subscription_period_end"] : []),
    ];
    const rows = payments.map((p) => {
        // Recu emis pour tout don encaisse (un don rembourse garde son numero, annule ensuite).
        const receipt = ["succeeded", "refunded", "disputed"].includes(p.status);
        const row = [
            p.user_id, p.amount, p.currency, p.method, p.provider, p.status, p.transaction_id, p.donor_name, p.donor_email,
            p.project_id, p.frequency, p.subscription_id, p.subscription_status, p.refunded_amount, p.refunded_at,
            receipt ? receipts.next(p.created_at) : null,
            token(24),
            receipt ? p.created_at : null,
            receipt ? p.donor_name : null,
            receipt ? p.donor_email : null,
            receipt ? p.projectTitle || "Fonds general" : null,
            receipt ? p.amount : null,
            receipt ? p.currency : null,
            receipt ? p.method : null,
            receipt ? p.frequency : null,
            p.paid_at,
            p.created_at,
        ];
        if (hasPeriodEnd) {
            row.push(p.subscription_status === "active" ? new Date(Date.now() + int(1, 30) * DAY) : null);
        }
        return row;
    });
    await insertMany("payments", columns, rows);
    await receipts.save();
    return { total: rows.length, subscribers: subscribers.length };
}

// ---------- Evenements et inscriptions ----------

async function seedEvents(members, projects, count, organizerId) {
    let registrations = 0;
    for (let n = 0; n < count; n += 1) {
        const region = REGIONS[n % REGIONS.length];
        const start = new Date(Date.now() + int(-2 * 365, 120) * DAY);
        start.setUTCHours(int(7, 15), 0, 0, 0);
        const end = new Date(start.getTime() + int(2, 8) * 3600000);
        const capacity = chance(0.3) ? null : int(8, 60);
        const project = chance(0.6) ? pick(projects) : null;
        const [result] = await db.query(
            `INSERT INTO events (title, description, location, region, start_at, end_at, capacity, project_id, published, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                `${pick(["Atelier", "Formation", "Collecte", "Visite", "Réunion", "Journée"])} ${region} #${n + 1}`,
                "Événement généré par seed-demo.",
                `Centre communautaire, ${region}`,
                region,
                start,
                end,
                capacity,
                project ? project.id : null,
                chance(0.9) ? 1 : 0,
                organizerId,
            ]
        );
        const local = members.filter((member) => member.region === region);
        const wanted = Math.min(capacity ?? 40, int(0, Math.max(1, local.length)));
        const attendees = [...local].sort(() => random() - 0.5).slice(0, wanted);
        if (attendees.length) {
            await db.query("INSERT IGNORE INTO event_registrations (event_id, user_id, created_at) VALUES ?", [
                attendees.map((member) => [result.insertId, member.id, new Date(Math.min(Date.now(), start.getTime() - int(1, 30) * DAY))]),
            ]);
            registrations += attendees.length;
        }
    }
    return registrations;
}

// ---------- Candidatures ----------

async function seedApplications(count, reviewerId) {
    const rows = [];
    for (let n = 0; n < count; n += 1) {
        const status = pick(["nouvelle", "nouvelle", "en_etude", "acceptee", "refusee"]);
        const interests = [...INTEREST_VALUES].sort(() => random() - 0.5).slice(0, int(1, 3));
        rows.push([
            `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
            `candidat.${n + 1}.${token(3)}@example.org`,
            chance(0.8) ? `+2376${int(50, 99)}${String(int(0, 999999)).padStart(6, "0")}` : null,
            pick(REGIONS),
            JSON.stringify(interests),
            "Candidature générée par seed-demo : je souhaite contribuer aux actions de HOPE dans ma région.",
            status,
            status === "nouvelle" ? null : reviewerId,
            daysAgo(int(0, 2 * 365)),
        ]);
    }
    await insertMany(
        "applications",
        ["name", "email", "phone", "region", "interests", "motivation", "status", "reviewer_id", "created_at"],
        rows
    );
}

async function userIdByEmail(email) {
    const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    return rows[0]?.id ?? null;
}

async function main() {
    const database = process.env.DB_NAME || "hope_platform";
    console.log(`seed-demo : base "${database}", echelle ${SCALE}, graine ${SEED}.`);
    try {
        await runMigrations();
        const members = await seedMembers(Math.round(200 * SCALE));
        const projects = await ensureProjects();
        const organizerId = (await userIdByEmail("orga@hope.org")) ?? (await userIdByEmail("admin@hope.org"));
        const reviewerId = (await userIdByEmail("rh@hope.org")) ?? organizerId;

        const payments = await seedPayments(members, projects, Math.round(1800 * SCALE));
        const registrations = await seedEvents(members, projects, Math.round(30 * SCALE), organizerId);
        await seedApplications(Math.round(60 * SCALE), reviewerId);
        await db.query("INSERT INTO activity_logs (user_id, action, meta) VALUES (NULL, 'seed.demo', ?)", [
            JSON.stringify({ scale: SCALE, seed: SEED, members: members.length, payments: payments.total }),
        ]);

        console.log(`Membres de demo : ${members.length} (@${DEMO_DOMAIN}, mot de passe Member@123)`);
        console.log(`Dons : ${payments.total} dont ${payments.subscribers} donateurs mensuels`);
        console.log(`Evenements : ${Math.round(30 * SCALE)} (${registrations} inscriptions)`);
        console.log(`Candidatures : ${Math.round(60 * SCALE)}`);
    } catch (error) {
        console.error("Erreur seed-demo :", error.message);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

main();
