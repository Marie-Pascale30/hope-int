const db = require("../config/db");

exports.get = async (key) => {
    const [rows] = await db.query("SELECT setting_value FROM app_settings WHERE setting_key = ?", [key]);
    return rows[0]?.setting_value ?? null;
};

exports.set = async (key, value) => {
    await db.query(
        "INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [key, value]
    );
};
