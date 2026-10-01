"use client";

// Matrice des roles (GET /admin/roles) et regles d'attribution, miroir de canGrantRoles cote backend.
// Le backend reste l'autorite : ces regles servent seulement a guider l'interface.
import { adminApi } from "../../../services";
import { useAsync } from "../../../hooks/useAsync";

let cache = null;

export function useRoleMatrix() {
  return useAsync(async () => {
    cache = cache || (await adminApi.roles());
    return cache;
  }, []);
}

// Un role est attribuable si l'on possede toutes ses permissions ; le role admin est reserve aux admins.
export function canGrantRole(user, entry) {
  if (!entry) return false;
  if (entry.role === "admin") return Boolean(user?.roles?.includes("admin"));
  const granted = user?.permissions || [];
  return entry.permissions.every((permission) => granted.includes(permission));
}

export function canGrantAll(user, matrix, roles = []) {
  return roles.every((role) => canGrantRole(user, matrix?.roles.find((entry) => entry.role === role)));
}

// Libelle d'un role d'apres la matrice (libelles longs du backend), sinon libelle local.
export function matrixRoleLabel(matrix, role, fallback) {
  return matrix?.roleLabels?.[role] || fallback(role);
}
