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

module.exports = db;
