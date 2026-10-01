// Permissions definies une seule fois dans @hope/shared (partage avec l'API). Le backend reste la seule
// autorite : cote client, ces permissions ne servent qu'a afficher ou masquer l'interface.
import { PERMISSIONS } from "@hope/shared/rbac";

export { PERMISSIONS };

export function can(user, ...permissions) {
  const granted = user?.permissions || [];
  return permissions.every((permission) => granted.includes(permission));
}

export function canAny(user, ...permissions) {
  const granted = user?.permissions || [];
  return permissions.some((permission) => granted.includes(permission));
}

export const isStaff = (user) => can(user, PERMISSIONS.ACCESS_ADMIN_DASHBOARD);
