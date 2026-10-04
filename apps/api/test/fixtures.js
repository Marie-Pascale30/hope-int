// Donnees de test complementaires (projets, dons, evenements, images) ; s'appuie sur helpers.js,
// qui doit rester importe en premier.
const helpers = require("./helpers");

const { db } = helpers;

// Image PNG 1x1 valide (signature binaire reelle).
const PNG_BYTES = Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
    "hex"
);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

async function insertProject({ title = "Projet test", region = null, published = 1, ...rest } = {}) {
    const [result] = await db.query(
        `INSERT INTO projects (title, description, region, published, status, start_date, end_date, beneficiaries, trainees, credits_granted, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            title,
            rest.description || "Description du projet de test",
            region,
            published,
            rest.status || "en_cours",
            rest.start_date || null,
            rest.end_date || null,
            rest.beneficiaries || 0,
            rest.trainees || 0,
            rest.credits_granted || 0,
            rest.image_url || null,
        ]
    );
    return result.insertId;
}

let paymentCounter = 0;
async function insertPayment({ amount = 10, currency = "eur", projectId = null, userId = null, email = null, status = "succeeded", paidAt = new Date() } = {}) {
    paymentCounter += 1;
    const [result] = await db.query(
        `INSERT INTO payments (user_id, amount, currency, method, provider, status, donor_name, donor_email, project_id, paid_at, receipt_token)
         VALUES (?, ?, ?, 'card', 'stripe', ?, ?, ?, ?, ?, ?)`,
        [userId, amount, currency, status, "Donateur test", email, projectId, paidAt, `tok${Date.now()}${paymentCounter}`.padEnd(48, "0").slice(0, 48)]
    );
    return result.insertId;
}

async function insertEvent({ title = "Événement test", startAt, endAt = null, region = null, published = 1, imageUrl = null } = {}) {
    const [result] = await db.query(
        `INSERT INTO events (title, description, location, region, start_at, end_at, published, image_url)
         VALUES (?, 'Description de l''événement', 'Douala', ?, ?, ?, ?, ?)`,
        [title, region, startAt, endAt, published, imageUrl]
    );
    return result.insertId;
}

// Requete multipart (formulaire avec image) en conservant la session du client.
function multipart(http, method, url, fields = {}, file = null) {
    let req = http.agent[method](url).set("X-Requested-With", "XMLHttpRequest");
    for (const [key, value] of Object.entries(fields)) req = req.field(key, String(value));
    if (file) req = req.attach("image", file.buffer, { filename: file.filename, contentType: file.contentType });
    return req;
}

async function lastLog(action) {
    const [rows] = await db.query("SELECT * FROM activity_logs WHERE action = ? ORDER BY id DESC LIMIT 1", [action]);
    const row = rows[0];
    if (!row) return null;
    return { ...row, meta: typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta };
}

const hoursFromNow = (hours) => new Date(Date.now() + hours * 3600 * 1000);

module.exports = {
    ...helpers,
    PNG_BYTES,
    JPEG_BYTES,
    insertProject,
    insertPayment,
    insertEvent,
    multipart,
    lastLog,
    hoursFromNow,
};
