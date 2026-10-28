require("dotenv").config();

const { refuseInProduction, warnBeforeTruncate } = require("./guard");

// Jamais en production (comptes de demo aux mots de passe publics), sauf --force explicite.
refuseInProduction("npm run seed");

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { runMigrations } = require("../config/migrate");
const { PHOTOS, photoUrl } = require("@hope/shared/photos");

// Galerie (colonne JSON) a partir d'albums ou de photos du livret : gallery("noel-2022-yaounde", "p15_03").
function gallery(...keys) {
    const photos = PHOTOS.filter((photo) => keys.includes(photo.album) || keys.includes(photo.id));
    return JSON.stringify(photos.map(({ src, width, height, kind }) => ({ src, width, height, kind })));
}

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
];

// Actions reelles de HOPE International Project (livret partenaires 2021-2025, guide de bienvenue).
// Les beneficiaires ne reprennent que les chiffres attestes par le livret ; les objectifs de collecte
// (EUR) sont indicatifs et se reglent dans l'administration. Les trois premiers projets recoivent
// les dons de demonstration (seedPayments).
const PROJECTS = [
    {
        title: "Parrainage éducatif des enfants",
        summary: "Accompagner chaque enfant parrainé de la rentrée jusqu'à son autonomie : frais de scolarité, fournitures et suivi.",
        description: "Depuis la rentrée 2023, HOPE International Project prend en charge la scolarité d'enfants orphelins ou issus de familles vulnérables, avec l'engagement de les accompagner jusqu'à leur insertion professionnelle.\n\nDieu Merci, notre premier filleul, accueilli à l'orphelinat Petit Dan & Sarah (Yaoundé), entame en 2025-2026 sa troisième année avec nous. Divine FOLIFACK, à Dschang, a rejoint le programme en 2024 en partenariat avec sa famille, et MASSOH NDAH Abigail, de l'orphelinat du Buisson Ardent (Yaoundé), en 2025.\n\nVotre don finance les frais de scolarité, les fournitures, l'uniforme et le suivi de chaque enfant. « C'est ici que l'espoir commence : un enfant, un avenir, un acte d'amour à la fois. »",
        image_url: photoUrl("p11_07"),
        gallery: gallery("rentree-2023-yaounde", "rentree-2024-yaounde", "rentree-2024-dschang", "rentree-2025-buisson-ardent", "rentree-2025-yaounde", "rentree-2025-dschang"),
        status: "en_cours", region: "Centre", start_date: "2023-09-01", end_date: null,
        budget: null, goal_amount: 1500, beneficiaries: 3, trainees: 0, credits_granted: 0,
    },
    {
        title: "Rentrée scolaire « Un sourire pour tous »",
        summary: "Chaque été, des fournitures scolaires pour les enfants défavorisés, jusque dans les villages les plus reculés.",
        description: "Chaque année, du 1er août au 1er septembre, HOPE International Project collecte et distribue des fournitures scolaires, des sacs et du matériel éducatif aux enfants qui en ont le plus besoin.\n\nNotre première rentrée solidaire a eu lieu en 2021-2022 au village de Balessing, dans l'Ouest du Cameroun. La campagne s'est depuis étendue aux orphelinats de Yaoundé et aux familles de Dschang.\n\n« Votre générosité porte l'espoir au cœur de chaque village et donne à chaque enfant la chance de rêver à nouveau. »",
        image_url: photoUrl("p06_05"),
        gallery: gallery("rentree-2021-balessing", "enseignants-2022-douala", "p15_04", "p22_01"),
        status: "en_cours", region: "Ouest", start_date: "2021-09-01", end_date: null,
        budget: null, goal_amount: 2000, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Noël de l'espoir pour les orphelins",
        summary: "La magie du cœur : vêtements, repas, friandises et jouets pour les orphelins de Douala et de Yaoundé.",
        description: "Chaque mois de décembre, nos membres partagent la joie de Noël avec les enfants des orphelinats et les familles vulnérables : vêtements, repas, friandises, jouets et moments de fête.\n\nNous avons rendu visite aux orphelinats Petit Dan & Sarah et Le Bon Berger (Nkoabang) à Yaoundé, à l'orphelinat Mère Teresa la Vénérable (ASENDEF) à Douala, ainsi qu'à une famille de Bonabéri Mabanda.\n\n« Une lumière d'amour pour les orphelins, parce que chaque enfant mérite un Noël. »",
        image_url: photoUrl("p12_12"),
        gallery: gallery("noel-2022-yaounde", "noel-2022-douala", "noel-2023-mere-teresa", "noel-2023-bonaberi", "noel-2023-bon-berger", "p15_03"),
        status: "en_cours", region: "Littoral", start_date: "2022-12-01", end_date: null,
        budget: null, goal_amount: 1500, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Autonomisation des femmes",
        summary: "Soutenir les mères seules et les femmes vulnérables dans leur activité, à l'occasion du 8 mars.",
        description: "À l'occasion de la Journée internationale des droits des femmes, HOPE International Project remet des chèques de soutien à des femmes qui font vivre leur famille avec courage et dignité.\n\nEn 2024, nous avons soutenu deux femmes à Yaoundé (snacks à base de soja, huile de palme) et, à Douala, Irène KAMENI (huile de palme) et Armelle Rofanie BOGNING NAMBOU (beignets et restauration), avec 50 000 FCFA chacune. En 2025, nous avons accompagné Sophie BESONG, femme en situation de handicap, dans son commerce à Yaoundé (75 000 FCFA).\n\nNous voulons aller plus loin : formations pratiques (couture, coiffure, agriculture…), insertion économique et, demain, microcrédit solidaire.",
        image_url: photoUrl("p17_01"),
        gallery: gallery("femmes-2024-yaounde", "femmes-2024-douala-irene", "femmes-2024-douala-armelle", "femmes-2025-yaounde", "p10_03", "p15_02", "p22_03"),
        status: "en_cours", region: "Littoral", start_date: "2024-03-08", end_date: null,
        budget: null, goal_amount: 1000, beneficiaries: 5, trainees: 0, credits_granted: 5,
    },
    {
        title: "Sensibilisation santé : VIH et drépanocytose",
        summary: "Informer le grand public sur la transmission et la prévention, et encourager le dépistage.",
        description: "HOPE International Project participe aux journées internationales de santé : Journée mondiale de lutte contre la drépanocytose le 19 juin (campagne de sensibilisation et tests d'électrophorèse en partenariat avec GEDREPACAM, 2023) et Journée mondiale de lutte contre le sida le 1er décembre (2024, 2025).\n\nNos prochaines campagnes porteront aussi sur les hépatites, les cancers et la nutrition, avec la distribution de kits d'hygiène.",
        image_url: photoUrl("p22_02"),
        gallery: gallery("p10_02", "p15_00", "p22_02", "sida-2025"),
        status: "en_cours", region: "Littoral", start_date: "2023-06-19", end_date: null,
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Un vêtement = Un sourire",
        summary: "Collectes de vêtements pour les camps de réfugiés, les prisons et les orphelinats.",
        description: "Deux grandes collectes de vêtements de tout genre ont été menées, du 20 novembre au 20 décembre 2022 puis du 15 novembre au 15 décembre 2023, pour habiller ceux qui ont froid : camps de réfugiés, prisons, orphelinats.",
        image_url: photoUrl("p10_01"),
        gallery: gallery("vetements-2022", "p10_01"),
        status: "termine", region: "Littoral", start_date: "2022-11-20", end_date: "2023-12-15",
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Académie HOPE",
        summary: "Une école avec bibliothèque, espace de loisirs, cantine et infirmerie pour les enfants défavorisés.",
        description: "Notre grand projet de développement communautaire : créer l'Académie HOPE, un lieu d'éducation complet comprenant une école, une bibliothèque, un espace de loisirs, une cantine et une infirmerie. Le projet comprend aussi la formation de bénévoles et de leaders locaux.",
        image_url: photoUrl("p20_09"),
        gallery: gallery("p20_09", "p20_05", "p25_05"),
        status: "planifie", region: "Littoral", start_date: null, end_date: null,
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Accès à l'eau potable dans les villages isolés",
        summary: "Construire des puits et des forages et sensibiliser à l'hygiène communautaire.",
        description: "HOPE International Project souhaite assister les communautés qui n'ont pas accès à l'eau potable : construction de puits et de forages, gestion par des comités d'habitants et sensibilisation à l'hygiène.",
        image_url: photoUrl("p21_02"),
        gallery: gallery("p21_02", "p06_07"),
        status: "planifie", region: "Ouest", start_date: null, end_date: null,
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Microcrédit et entrepreneuriat solidaire",
        summary: "Piste de développement : des microcrédits à taux solidaire pour les mères et les jeunes porteurs de projet.",
        description: "Dans le prolongement des chèques de soutien du 8 mars, nous étudions la création d'un programme de microcrédit solidaire : petits prêts accompagnés d'une formation en gestion et d'un suivi régulier, remboursements réinvestis dans de nouvelles activités (commerce de proximité, transformation agricole, couture, élevage).\n\nCe projet est à l'étude ; il sera lancé lorsque les partenariats et les ressources nécessaires seront réunis.",
        image_url: photoUrl("p23_05"),
        gallery: gallery("p16_06", "p16_08", "p23_04", "p23_05"),
        status: "planifie", region: "Littoral", start_date: null, end_date: null,
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Formations pratiques pour les jeunes filles mères",
        summary: "Couture, coiffure, agriculture… pour permettre aux jeunes mères de subvenir dignement aux besoins de leurs enfants.",
        description: "Accompagnement social et psychologique, formations pratiques (couture, coiffure, agriculture, mécanique, bâtiment) et aide à l'insertion économique des jeunes filles mères. Le programme pourra s'appuyer sur des groupes d'entraide et sur le futur microcrédit solidaire.",
        image_url: photoUrl("p16_03"),
        gallery: gallery("p16_03", "p18_04"),
        status: "planifie", region: "Centre", start_date: null, end_date: null,
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
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
            `INSERT INTO news (title, summary, content, image_url, gallery, project_id, created_at) VALUES ?`,
            [[
                ["Rentrée 2025-2026 : Abigail devient notre troisième filleule", "À l'orphelinat du Buisson Ardent, à Yaoundé, nous nous engageons auprès d'Abigail pour toute sa scolarité.",
                    "Pour la rentrée 2025-2026, HOPE International Project accueille dans son programme de parrainage MASSOH NDAH Abigail, de l'orphelinat du Buisson Ardent (ASEEODRCAM) à Yaoundé. Nous nous engageons à l'accompagner tout au long de son parcours scolaire, avec amour et dévouement.\n\nLa même rentrée marque la troisième année de Dieu Merci (orphelinat Petit Dan & Sarah) et la deuxième de Divine FOLIFACK à Dschang : fournitures, sacs, uniformes et frais de scolarité leur ont été remis.",
                    photoUrl("p24_09"), gallery("rentree-2025-buisson-ardent", "rentree-2025-yaounde", "rentree-2025-dschang"), projectIds[0], new Date("2025-09-15T10:00:00Z")],
                ["8 mars 2025 : soutien à Sophie BESONG", "Pour la Journée des droits des femmes, nous avons accompagné une commerçante en situation de handicap à Yaoundé.",
                    "En cette Journée internationale des droits des femmes, HOPE International Project célèbre la remarquable résilience de Sophie BESONG, femme vivant avec un handicap, que nous avons eu l'honneur de soutenir avec un chèque de 75 000 FCFA pour son commerce. Son parcours reflète la force et l'espoir au cœur de notre mission.\n\nGrâce à votre générosité, nous pouvons continuer à aider des femmes comme Sophie à briller avec confiance et dignité.",
                    photoUrl("p23_02"), gallery("femmes-2025-yaounde"), projectIds[3], new Date("2025-03-15T10:00:00Z")],
                ["Une lumière d'amour pour les orphelins de Douala", "Noël à l'orphelinat Mère Teresa la Vénérable et auprès d'une famille de Bonabéri Mabanda.",
                    "Pour Noël, nos membres ont partagé la magie du cœur avec les enfants de l'orphelinat Mère Teresa la Vénérable (ASENDEF) à Douala : vêtements, vivres, friandises et un après-midi de fête. Nous avons aussi rendu visite à une famille de Bonabéri Mabanda.\n\nÀ Yaoundé, les enfants de l'orphelinat Le Bon Berger (Nkoabang) ont reçu la même visite. Parce que chaque enfant mérite un Noël.",
                    photoUrl("p12_12"), gallery("noel-2023-mere-teresa", "noel-2023-bonaberi", "noel-2023-bon-berger"), projectIds[2], new Date("2023-12-22T10:00:00Z")],
                ["Soutien à Noël Clinton, au service des personnes de la rue", "Un ancien sans-abri devenu aidant reçoit 100 000 FCFA pour poursuivre son engagement à Douala.",
                    "Le 19 juin 2024, HOPE International Project a apporté son soutien à Noël Clinton, un homme de bonne volonté qui a lui-même vécu dans la rue et qui, après avoir reçu son appel, prend aujourd'hui soin des personnes sans abri à Douala. HOPE International Project reste engagé auprès de ceux qui sont dans le besoin.",
                    photoUrl("p19_03"), gallery("solidarite-rue-2024"), null, new Date("2024-06-19T10:00:00Z")],
                ["Journée mondiale des enseignants à Douala", "HOPE International Project soutient les enseignants dans leur belle mission d'éduquer nos enfants.",
                    "À l'occasion de la Journée mondiale des enseignants, nos membres sont allés à la rencontre d'enseignantes de Douala pour leur remettre des présents et saluer leur vocation. Soutenir les enseignants dans l'exercice de leur métier fait partie de nos priorités pour l'éducation.",
                    photoUrl("p07_05"), gallery("enseignants-2022-douala"), null, new Date("2022-10-05T10:00:00Z")],
            ]]
        );
    }

    if (await isEmpty("testimonials")) {
        await db.query(
            "INSERT INTO testimonials (author, role_label, content, project_id) VALUES ?",
            [[
                // Citations des documents officiels, en attendant les temoignages recueillis aupres des beneficiaires.
                ["HOPE International Project", "Guide de bienvenue", "Nous croyons que l'amour de Dieu, manifesté par des actes concrets, transforme des vies.", null],
                ["HOPE International Project", "Guide de bienvenue", "Nous investissons dans les rêves, la santé et la dignité des personnes les plus démunies, avec bienveillance, expertise et engagement durable.", projectIds[0]],
                ["HOPE International Project", "Livret partenaires", "Votre générosité porte l'espoir au cœur de chaque village et donne à chaque enfant la chance de rêver à nouveau.", projectIds[1]],
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
