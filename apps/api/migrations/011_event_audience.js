// Public des evenements : "volunteers" (benevolat, reserve aux comptes invites) ou "members"
// (evenements internes : assemblee generale, reunions). Les assemblees generales deja saisies
// passent en "members". Rejouable : addColumn verifie l'etat du schema, la mise a jour est idempotente.
const { addColumn } = require("../config/schema");

exports.up = async ({ db }) => {
    await addColumn("events", "audience", "VARCHAR(20) NOT NULL DEFAULT 'volunteers'");
    await db.query("UPDATE events SET audience = 'members' WHERE title LIKE 'Assemblée générale%'");
};
