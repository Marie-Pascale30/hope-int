// Fragments SQL partages par les requetes de statistiques (alias "p" = payments).
const { XAF_PER_EUR } = require("@hope/shared/constants");

// Donateur unique : le compte s'il y en a un, sinon l'email saisi (insensible a la casse).
// Une seule definition pour tous les compteurs de donateurs.
const DONOR_KEY_SQL = "COALESCE(CONCAT('u:', p.user_id), CONCAT('e:', LOWER(p.donor_email)))";

// Montant net d'un don (remboursements partiels deduits), dans sa devise puis en euros.
const NET_AMOUNT_SQL = "(p.amount - COALESCE(p.refunded_amount, 0))";
const NET_EUR_SQL = `CASE WHEN p.currency = 'xaf' THEN ${NET_AMOUNT_SQL} / ${XAF_PER_EUR} ELSE ${NET_AMOUNT_SQL} END`;

module.exports = { DONOR_KEY_SQL, NET_AMOUNT_SQL, NET_EUR_SQL };
