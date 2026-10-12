const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: Number(process.env.DB_QUEUE_LIMIT || 0),
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    // Toutes les dates circulent en UTC (Node <-> MySQL), le frontend les affiche en heure locale.
    timezone: "Z",
    // Colonnes DATE (sans heure) renvoyees telles quelles : "2026-03-01".
    dateStrings: ["DATE"],
    charset: "utf8mb4",
});

db.pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
});

// Execute work(connection) dans une transaction sur une connexion dediee du pool : commit si
// tout reussit, rollback sinon (une erreur de rollback ne masque jamais l'erreur d'origine).
async function withTransaction(work) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback().catch(() => {});
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = db;
module.exports.withTransaction = withTransaction;
