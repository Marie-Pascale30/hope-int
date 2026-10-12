const db = require("../config/db");
const { XAF_PER_EUR, SUCCESS_PAYMENT_STATUSES } = require("@hope/shared/constants");

const STATUS_LIST = SUCCESS_PAYMENT_STATUSES.map((status) => db.escape(status)).join(", ");

// --- Modeles ---

exports.listTemplates = async () => {
    const [rows] = await db.query("SELECT id, name, subject, body, created_at, updated_at FROM campaign_templates ORDER BY name ASC, id ASC");
    return rows;
};

exports.findTemplate = async (id) => {
    const [rows] = await db.query("SELECT * FROM campaign_templates WHERE id = ?", [id]);
    return rows[0] || null;
};

exports.createTemplate = async ({ name, subject, body }, userId) => {
    const [result] = await db.query("INSERT INTO campaign_templates (name, subject, body, created_by) VALUES (?, ?, ?, ?)", [name, subject, body, userId]);
    return result.insertId;
};

exports.updateTemplate = async (id, { name, subject, body }) => {
    const [result] = await db.query("UPDATE campaign_templates SET name = ?, subject = ?, body = ? WHERE id = ?", [name, subject, body, id]);
    return result.affectedRows > 0;
};

exports.removeTemplate = async (id) => {
    const [result] = await db.query("DELETE FROM campaign_templates WHERE id = ?", [id]);
    return result.affectedRows > 0;
};

// --- Campagnes ---

function mapCampaign(row) {
    if (!row) return row;
    let params = {};
    try {
        params = row.audience_params ? JSON.parse(row.audience_params) : {};
    } catch (_error) {
        params = {};
    }
    return { ...row, audience_params: params };
}

exports.listCampaigns = async () => {
    const [rows] = await db.query(
        `SELECT c.*, u.name AS author_name,
                (SELECT COUNT(*) FROM campaign_recipients r WHERE r.campaign_id = c.id AND r.skipped = 0) AS recipients
         FROM campaigns c LEFT JOIN users u ON u.id = c.created_by
         ORDER BY c.created_at DESC, c.id DESC LIMIT 200`
    );
    return rows.map((row) => ({ ...mapCampaign(row), recipients: Number(row.recipients) }));
};

exports.findCampaign = async (id) => {
    const [rows] = await db.query("SELECT * FROM campaigns WHERE id = ?", [id]);
    return mapCampaign(rows[0]);
};

exports.createCampaign = async (data, userId) => {
    const [result] = await db.query(
        "INSERT INTO campaigns (name, subject, body, topic, audience, audience_params, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [data.name, data.subject, data.body, data.topic, data.audience, JSON.stringify(data.audienceParams || {}), userId]
    );
    return result.insertId;
};

exports.updateDraft = async (id, data) => {
    const [result] = await db.query(
        `UPDATE campaigns SET name = ?, subject = ?, body = ?, topic = ?, audience = ?, audience_params = ?
         WHERE id = ? AND status = 'draft'`,
        [data.name, data.subject, data.body, data.topic, data.audience, JSON.stringify(data.audienceParams || {}), id]
    );
    return result.affectedRows > 0;
};

exports.removeDraft = async (id) => {
    const [result] = await db.query("DELETE FROM campaigns WHERE id = ? AND status = 'draft'", [id]);
    return result.affectedRows > 0;
};

// Passage atomique brouillon -> envoi en cours (un seul envoi par campagne).
exports.markSending = async (id) => {
    const [result] = await db.query("UPDATE campaigns SET status = 'sending', started_at = NOW() WHERE id = ? AND status = 'draft'", [id]);
    return result.affectedRows > 0;
};

exports.markSent = async (id) => {
    await db.query("UPDATE campaigns SET status = 'sent', sent_at = NOW() WHERE id = ? AND status = 'sending'", [id]);
};

exports.sendingIds = async () => {
    const [rows] = await db.query("SELECT id FROM campaigns WHERE status = 'sending' ORDER BY id ASC");
    return rows.map((row) => row.id);
};

exports.recipientEmails = async (campaignId) => {
    const [rows] = await db.query("SELECT email FROM campaign_recipients WHERE campaign_id = ?", [campaignId]);
    return new Set(rows.map((row) => row.email));
};

// Reserve le destinataire (cle unique) : false s'il est deja traite par une autre instance.
exports.reserveRecipient = async (campaignId, email) => {
    const [result] = await db.query("INSERT IGNORE INTO campaign_recipients (campaign_id, email) VALUES (?, ?)", [campaignId, email]);
    return result.affectedRows > 0;
};

exports.setRecipientOutbox = async (campaignId, email, outboxId) => {
    await db.query("UPDATE campaign_recipients SET outbox_id = ? WHERE campaign_id = ? AND email = ?", [outboxId, campaignId, email]);
};

exports.markRecipientSkipped = async (campaignId, email) => {
    await db.query("UPDATE campaign_recipients SET skipped = 1 WHERE campaign_id = ? AND email = ?", [campaignId, email]);
};

exports.stats = async (campaignId) => {
    const [[row]] = await db.query(
        `SELECT SUM(r.skipped = 0) AS recipients, SUM(r.skipped = 1) AS skipped,
                SUM(o.status = 'sent') AS sent, SUM(o.status = 'failed') AS failed, SUM(o.status = 'pending') AS pending
         FROM campaign_recipients r LEFT JOIN email_outbox o ON o.id = r.outbox_id
         WHERE r.campaign_id = ?`,
        [campaignId]
    );
    return {
        recipients: Number(row.recipients || 0),
        skipped: Number(row.skipped || 0),
        sent: Number(row.sent || 0),
        failed: Number(row.failed || 0),
        pending: Number(row.pending || 0),
    };
};

// --- Nouvelles des projets ---

exports.projectNewsCandidates = async () => {
    const [rows] = await db.query(
        `SELECT n.id, n.title, n.summary, n.created_at, n.project_id, p.title AS project_title,
                d.created_at AS dispatched_at, d.recipients AS dispatched_recipients
         FROM news n JOIN projects p ON p.id = n.project_id
         LEFT JOIN project_news_dispatches d ON d.news_id = n.id
         WHERE n.published = 1
         ORDER BY n.created_at DESC, n.id DESC LIMIT 100`
    );
    return rows;
};

exports.findPublishedNews = async (id) => {
    const [rows] = await db.query(
        `SELECT n.id, n.title, n.summary, n.content, n.project_id, p.title AS project_title
         FROM news n JOIN projects p ON p.id = n.project_id
         WHERE n.id = ? AND n.published = 1`,
        [id]
    );
    return rows[0] || null;
};

exports.findDispatch = async (newsId) => {
    const [rows] = await db.query("SELECT * FROM project_news_dispatches WHERE news_id = ?", [newsId]);
    return rows[0] || null;
};

// Marqueur pose avant l'envoi : la cle primaire refuse un second envoi (meme concurrent).
exports.claimDispatch = async (newsId, projectId, userId) => {
    const [result] = await db.query(
        "INSERT IGNORE INTO project_news_dispatches (news_id, project_id, sent_by) VALUES (?, ?, ?)",
        [newsId, projectId, userId]
    );
    return result.affectedRows > 0;
};

exports.setDispatchRecipients = async (newsId, count) => {
    await db.query("UPDATE project_news_dispatches SET recipients = ? WHERE news_id = ?", [count, newsId]);
};

// --- Espace membre : projets soutenus ---

exports.supportedProjects = async ({ userId, email }) => {
    const [rows] = await db.query(
        `SELECT pr.id, pr.title, pr.summary, pr.image_url, pr.image_alt, pr.status, pr.region, pr.goal_amount,
                SUM(CASE WHEN LOWER(p.currency) = 'xaf' THEN (p.amount - COALESCE(p.refunded_amount, 0)) / ${XAF_PER_EUR}
                         ELSE p.amount - COALESCE(p.refunded_amount, 0) END) AS my_total_eur,
                COUNT(*) AS my_donations, MAX(COALESCE(p.paid_at, p.created_at)) AS last_donation_at
         FROM payments p JOIN projects pr ON pr.id = p.project_id
         WHERE p.status IN (${STATUS_LIST}) AND pr.published = 1
           AND (p.user_id = ? OR (p.user_id IS NULL AND LOWER(p.donor_email) = ?))
         GROUP BY pr.id
         ORDER BY last_donation_at DESC`,
        [userId, String(email || "").toLowerCase()]
    );
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const marks = ids.map(() => "?").join(", ");
    const [raised] = await db.query(
        `SELECT project_id, SUM(CASE WHEN LOWER(currency) = 'xaf' THEN (amount - COALESCE(refunded_amount, 0)) / ${XAF_PER_EUR}
                                    ELSE amount - COALESCE(refunded_amount, 0) END) AS raised_eur, COUNT(*) AS donations
         FROM payments WHERE status IN (${STATUS_LIST}) AND project_id IN (${marks}) GROUP BY project_id`,
        ids
    );
    const [news] = await db.query(
        `SELECT id, project_id, title, summary, created_at FROM (
           SELECT n.*, ROW_NUMBER() OVER (PARTITION BY n.project_id ORDER BY n.created_at DESC, n.id DESC) AS rn
           FROM news n WHERE n.published = 1 AND n.project_id IN (${marks})
         ) ranked WHERE rn <= 3 ORDER BY created_at DESC`,
        ids
    );
    const raisedBy = Object.fromEntries(raised.map((row) => [row.project_id, row]));
    return rows.map((row) => {
        const goal = row.goal_amount === null ? null : Number(row.goal_amount);
        const raisedEur = Number(raisedBy[row.id]?.raised_eur || 0);
        return {
            id: row.id,
            title: row.title,
            summary: row.summary,
            image_url: row.image_url,
            image_alt: row.image_alt,
            status: row.status,
            region: row.region,
            goal_eur: goal,
            raised_eur: Math.round(raisedEur * 100) / 100,
            progress: goal ? Math.min(100, Math.round((raisedEur / goal) * 100)) : null,
            my_total_eur: Math.round(Number(row.my_total_eur) * 100) / 100,
            my_donations: Number(row.my_donations),
            last_donation_at: row.last_donation_at,
            news: news.filter((item) => item.project_id === row.id).map(({ id, title, summary, created_at }) => ({ id, title, summary, created_at })),
        };
    });
};
