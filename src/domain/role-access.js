import { MODULE_ACCESS, ROLE_LABELS, ROLE_ORDER, isModuleAllowed } from './access-control.js';

export const CANONICAL_ROLES = ROLE_ORDER;

function normalizeUsername(username) {
  return String(username ?? '')
    .trim()
    .toLowerCase();
}

export function rolesForUsername(roleUsers, username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return [];
  const role = CANONICAL_ROLES.find((entry) =>
    (roleUsers?.[entry] ?? []).some((row) => row.username === normalized),
  );
  return role ? [role] : [];
}

export function modulesForRoles(roles = []) {
  const modules = [];
  for (const role of CANONICAL_ROLES) {
    if (!roles.includes(role)) continue;
    for (const moduleId of Object.keys(MODULE_ACCESS)) {
      if (isModuleAllowed(role, moduleId) && !modules.includes(moduleId)) modules.push(moduleId);
    }
  }
  return modules;
}

export function isModuleAllowedForRoles(roles = [], moduleId) {
  return roles.some((role) => isModuleAllowed(role, moduleId));
}

export function visibleEmployeeNamesFor(role) {
  return role === 'supervisor' || role === 'plant_manager';
}

export function visibleTechnicianNamesFor(role) {
  return role === 'maintenance' || role === 'plant_manager';
}

export function roleLabel(role) {
  return ROLE_LABELS[role] ?? String(role ?? '');
}

export function roleChangeMessage(role) {
  return `¿Deseas cambiar tu vista al rol ${roleLabel(role)}?`;
}
