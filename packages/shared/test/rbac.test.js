const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
    PERMISSIONS: P,
    ORG_ROLES,
    PERMISSION_LABELS,
    ROLE_LABELS,
    normalizeRoles,
    getPermissionsForRoles,
    hasPermission,
    hasGlobalScope,
    isRegionScoped,
    canGrantRoles,
    getRoleMatrix,
} = require("../src/rbac");

describe("rbac", () => {
    it("documente chaque permission et chaque role", () => {
        for (const permission of Object.values(P)) assert.ok(PERMISSION_LABELS[permission], permission);
        for (const role of ORG_ROLES) assert.ok(ROLE_LABELS[role], role);
    });

    it("ne garde que les roles connus, sans doublon", () => {
        assert.deepEqual(normalizeRoles([" admin ", "admin", "inconnu", 42, "membre"]), ["admin", "membre"]);
        assert.deepEqual(normalizeRoles("admin"), []);
        assert.deepEqual(normalizeRoles(undefined), []);
    });

    it("cumule les permissions de plusieurs roles", () => {
        const permissions = getPermissionsForRoles(["responsable_finance", "responsable_rh"]);

        assert.ok(permissions.includes(P.MANAGE_FINANCE));
        assert.ok(permissions.includes(P.MANAGE_HR));
        assert.equal(new Set(permissions).size, permissions.length);
    });

    it("ne donne aucun droit d'administration a un membre", () => {
        assert.deepEqual(getPermissionsForRoles(["membre"]), []);
        assert.equal(hasPermission("membre", P.ACCESS_ADMIN_DASHBOARD), false);
    });

    it("donne toutes les permissions a l'admin et au pole IT", () => {
        for (const role of ["admin", "responsable_it"]) {
            assert.deepEqual(new Set(getPermissionsForRoles([role])), new Set(Object.values(P)));
        }
    });

    it("limite la portee globale aux roles prevus", () => {
        assert.equal(hasGlobalScope(["directrice_regionale"]), false);
        assert.equal(hasGlobalScope(["directrice_regionale", "directrice_generale"]), true);
    });

    it("restreint a sa region la directrice regionale seulement", () => {
        assert.equal(isRegionScoped(["directrice_regionale"]), true);
        assert.equal(isRegionScoped(["directrice_regionale", "organisatrice"]), true);
        assert.equal(isRegionScoped(["directrice_regionale", "directrice_generale"]), false);
        for (const role of ["admin", "directrice_generale", "responsable_it", "organisatrice", "secretaire_generale", "membre"]) {
            assert.equal(isRegionScoped([role]), false, role);
        }
        assert.equal(isRegionScoped([]), false);
    });

    describe("canGrantRoles", () => {
        it("reserve le role admin aux administrateurs", () => {
            assert.equal(canGrantRoles(["admin"], ["admin"]), true);
            assert.equal(canGrantRoles(["responsable_it"], ["admin"]), false);
        });

        it("n'autorise que des roles dont on possede tous les droits", () => {
            assert.equal(canGrantRoles(["responsable_rh"], ["membre"]), true);
            assert.equal(canGrantRoles(["responsable_rh"], ["responsable_finance"]), false);
            assert.equal(canGrantRoles(["directrice_generale"], ["responsable_finance", "organisatrice"]), true);
        });

        it("permet au pole IT d'attribuer tous les roles sauf admin", () => {
            const grantable = ORG_ROLES.filter((role) => canGrantRoles(["responsable_it"], [role]));
            assert.deepEqual(grantable, ORG_ROLES.filter((role) => role !== "admin"));
        });
    });

    it("expose une matrice complete pour l'interface", () => {
        const matrix = getRoleMatrix();

        assert.equal(matrix.length, ORG_ROLES.length);
        assert.equal(matrix.find((entry) => entry.role === "admin").multiAssignable, false);
    });
});
