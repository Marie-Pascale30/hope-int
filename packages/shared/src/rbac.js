// Roles, permissions et regles d'attribution. Le backend reste la seule autorite :
// cote site, ces donnees ne servent qu'a afficher ou masquer l'interface.

const PERMISSIONS = {
    ACCESS_ADMIN_DASHBOARD: "access_admin_dashboard",
    VIEW_USERS: "view_users",
    MANAGE_USER_ROLES: "manage_user_roles",
    DELETE_USERS: "delete_users",
    VIEW_MESSAGES: "view_messages",
    MANAGE_APPLICATIONS: "manage_applications",
    VIEW_DONATIONS: "view_donations",
    VIEW_STATS: "view_stats",
    VIEW_LOGS: "view_logs",
    MANAGE_CONTENT: "manage_content",
    // Fiches membres : coordonnees, region, competences, disponibilites, activation.
    MANAGE_HR: "manage_hr",
    // Exports comptables, rapprochement des paiements, bilan financier.
    MANAGE_FINANCE: "manage_finance",
    // Evenements et actions terrain, inscriptions des benevoles.
    MANAGE_ORGANIZATION: "manage_organization",
    // Etat du systeme et configuration technique.
    MANAGE_IT: "manage_it",
    // Tableau de bord regional (limite a sa region hors roles a portee globale).
    MANAGE_REGIONAL: "manage_regional",
};

const PERMISSION_LABELS = {
    access_admin_dashboard: "Accéder au tableau de bord",
    view_users: "Voir les membres",
    manage_user_roles: "Créer des comptes et gérer les rôles",
    delete_users: "Supprimer des comptes",
    view_messages: "Traiter les messages",
    manage_applications: "Traiter les candidatures",
    view_donations: "Voir les dons",
    view_stats: "Voir les statistiques et le rapport annuel",
    view_logs: "Consulter le journal d'activité",
    manage_content: "Gérer projets, actualités et témoignages",
    manage_hr: "Gérer les fiches membres (RH)",
    manage_finance: "Finance : exports, rapprochement, bilan",
    manage_organization: "Gérer les événements et actions terrain",
    manage_it: "Superviser le système (IT)",
    manage_regional: "Tableau de bord régional",
};

const ROLE_LABELS = {
    admin: "Administrateur système",
    directrice_generale: "Directrice générale",
    conseiller: "Conseiller stratégique",
    responsable_rh: "Responsable des ressources humaines",
    responsable_finance: "Responsable financier",
    organisatrice: "Organisatrice",
    responsable_it: "Responsable du pôle IT",
    directrice_regionale: "Directrice régionale",
    secretaire_generale: "Secrétaire générale",
    membre: "Membre",
};

const ROLE_PERMISSIONS = {
    admin: Object.values(PERMISSIONS),
    directrice_generale: [
        PERMISSIONS.ACCESS_ADMIN_DASHBOARD,
        PERMISSIONS.VIEW_USERS,
        PERMISSIONS.MANAGE_USER_ROLES,
        PERMISSIONS.VIEW_MESSAGES,
        PERMISSIONS.MANAGE_APPLICATIONS,
        PERMISSIONS.VIEW_DONATIONS,
        PERMISSIONS.VIEW_STATS,
        PERMISSIONS.VIEW_LOGS,
        PERMISSIONS.MANAGE_CONTENT,
        PERMISSIONS.MANAGE_HR,
        PERMISSIONS.MANAGE_FINANCE,
        PERMISSIONS.MANAGE_ORGANIZATION,
        PERMISSIONS.MANAGE_REGIONAL,
    ],
    conseiller: [
        PERMISSIONS.ACCESS_ADMIN_DASHBOARD,
        PERMISSIONS.VIEW_USERS,
        PERMISSIONS.VIEW_MESSAGES,
        PERMISSIONS.VIEW_DONATIONS,
        PERMISSIONS.VIEW_STATS,
    ],
    responsable_rh: [
        PERMISSIONS.ACCESS_ADMIN_DASHBOARD,
        PERMISSIONS.VIEW_USERS,
        PERMISSIONS.MANAGE_USER_ROLES,
        PERMISSIONS.MANAGE_APPLICATIONS,
        PERMISSIONS.VIEW_STATS,
        PERMISSIONS.MANAGE_HR,
    ],
    responsable_finance: [
        PERMISSIONS.ACCESS_ADMIN_DASHBOARD,
        PERMISSIONS.VIEW_DONATIONS,
        PERMISSIONS.VIEW_STATS,
        PERMISSIONS.MANAGE_FINANCE,
    ],
    organisatrice: [
        PERMISSIONS.ACCESS_ADMIN_DASHBOARD,
        PERMISSIONS.VIEW_MESSAGES,
        PERMISSIONS.VIEW_STATS,
        PERMISSIONS.MANAGE_CONTENT,
        PERMISSIONS.MANAGE_ORGANIZATION,
    ],
    // Le pole IT a toutes les capacites applicatives, sans pouvoir attribuer le role admin.
    responsable_it: Object.values(PERMISSIONS),
    directrice_regionale: [
        PERMISSIONS.ACCESS_ADMIN_DASHBOARD,
        PERMISSIONS.VIEW_MESSAGES,
        PERMISSIONS.VIEW_STATS,
        PERMISSIONS.MANAGE_CONTENT,
        PERMISSIONS.MANAGE_REGIONAL,
    ],
    secretaire_generale: [
        PERMISSIONS.ACCESS_ADMIN_DASHBOARD,
        PERMISSIONS.VIEW_USERS,
        PERMISSIONS.VIEW_MESSAGES,
        PERMISSIONS.MANAGE_APPLICATIONS,
        PERMISSIONS.VIEW_STATS,
        PERMISSIONS.MANAGE_ORGANIZATION,
    ],
    membre: [],
};

// Roles dont la vue regionale n'est pas limitee a la region de leur fiche.
const GLOBAL_SCOPE_ROLES = ["admin", "directrice_generale", "responsable_it"];

const ORG_ROLES = Object.keys(ROLE_PERMISSIONS);

function normalizeRoles(roles) {
    const input = Array.isArray(roles) ? roles : [];
    const clean = input
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => ORG_ROLES.includes(value));

    return Array.from(new Set(clean));
}

function getRolePermissions(role) {
    return ROLE_PERMISSIONS[role] || [];
}

function getPermissionsForRoles(roles) {
    const validRoles = normalizeRoles(roles);
    const aggregated = validRoles.flatMap((role) => getRolePermissions(role));
    return Array.from(new Set(aggregated));
}

function hasPermission(rolesOrRole, permission) {
    const roles = Array.isArray(rolesOrRole) ? rolesOrRole : [rolesOrRole];
    return getPermissionsForRoles(roles).includes(permission);
}

function hasGlobalScope(roles) {
    return normalizeRoles(roles).some((role) => GLOBAL_SCOPE_ROLES.includes(role));
}

// Un acteur ne peut attribuer (ou retirer) que des roles dont toutes les permissions
// sont deja les siennes ; seul un admin peut attribuer le role admin.
function canGrantRoles(actorRoles, roles) {
    const actorIsAdmin = normalizeRoles(actorRoles).includes("admin");
    const actorPermissions = getPermissionsForRoles(actorRoles);

    return normalizeRoles(roles).every((role) => {
        if (role === "admin") return actorIsAdmin;
        return getRolePermissions(role).every((permission) => actorPermissions.includes(permission));
    });
}

function getRoleMatrix() {
    return ORG_ROLES.map((roleKey) => ({
        role: roleKey,
        label: ROLE_LABELS[roleKey] || roleKey,
        permissions: getRolePermissions(roleKey),
        multiAssignable: roleKey !== "admin",
    }));
}

module.exports = {
    PERMISSIONS,
    PERMISSION_LABELS,
    ROLE_LABELS,
    ROLE_PERMISSIONS,
    GLOBAL_SCOPE_ROLES,
    ORG_ROLES,
    normalizeRoles,
    getRolePermissions,
    getPermissionsForRoles,
    hasPermission,
    hasGlobalScope,
    canGrantRoles,
    getRoleMatrix,
};
