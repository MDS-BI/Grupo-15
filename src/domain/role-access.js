import { MODULE_ACCESS, ROLE_LABELS, isModuleAllowed } from './access-control.js';

export const CANONICAL_ROLES = Object.freeze([
  'plant_manager',
  'supervisor',
  'planner',
  'operator',
  'maintenance',
]);

function normalizeUsername(username) {
  return String(username ?? '')
    .trim()
    .toLowerCase();
}

export function rolesForUsername(roleUsers, username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return [];
  return CANONICAL_ROLES.filter((role) =>
    (roleUsers?.[role] ?? []).some((row) => row.username === normalized),
  );
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
