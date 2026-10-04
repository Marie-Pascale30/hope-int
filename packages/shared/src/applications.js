// Candidatures : les poles d'interet sont des preferences indicatives du candidat.
// Ils n'ont aucune valeur de droit : les roles sont choisis par l'equipe a l'acceptation.

const INTEREST_AREAS = [
    { value: "terrain", label: "Actions de terrain et logistique" },
    { value: "sante", label: "Santé et accompagnement social" },
    { value: "education", label: "Éducation et formation" },
    { value: "entrepreneuriat", label: "Microcrédit et entrepreneuriat" },
    { value: "communication", label: "Communication et réseaux sociaux" },
    { value: "collecte", label: "Collecte de fonds et partenariats" },
    { value: "informatique", label: "Informatique et numérique" },
    { value: "administration", label: "Administration, secrétariat et comptabilité" },
    { value: "autre", label: "Autre" },
];

const INTEREST_VALUES = INTEREST_AREAS.map((area) => area.value);

// Ne garde que les valeurs connues, sans doublon, dans l'ordre du referentiel.
function normalizeInterests(values) {
    const input = Array.isArray(values) ? values : [];
    const wanted = new Set(input.filter((value) => typeof value === "string").map((value) => value.trim()));
    return INTEREST_VALUES.filter((value) => wanted.has(value));
}

function getInterestLabel(value) {
    const area = INTEREST_AREAS.find((entry) => entry.value === value);
    return area ? area.label : value;
}

module.exports = {
    INTEREST_AREAS,
    INTEREST_VALUES,
    normalizeInterests,
    getInterestLabel,
};
