/**
 * @file Control de acceso por rol de usuario.
 * Define los roles simulados del módulo y qué páginas puede ver cada uno.
 */

export const USER_ROLES = Object.freeze({
  OPERATOR: 'operator',
  SUPERVISOR: 'supervisor',
  PLANNER: 'planner',
  PLANT_MANAGER: 'plant_manager',
  MAINTENANCE: 'maintenance',
});

export const ROLE_ORDER = Object.freeze([
  USER_ROLES.OPERATOR,
  USER_ROLES.SUPERVISOR,
  USER_ROLES.PLANNER,
  USER_ROLES.PLANT_MANAGER,
  USER_ROLES.MAINTENANCE,
]);

export const DEFAULT_ROLE = USER_ROLES.PLANT_MANAGER;

export const ADMIN_ROLE = DEFAULT_ROLE;

export const ROLE_LABELS = Object.freeze({
  operator: 'Operador de Máquina',
  supervisor: 'Supervisor de línea',
  planner: 'Planificador',
  plant_manager: 'Jefa de Planta',
  maintenance: 'Encargado de Mantenimiento',
});

export const ROLE_DESCRIPTIONS = Object.freeze({
  operator: 'Registra turnos, reporta atrasos y consulta el calendario asignado.',
  supervisor: 'Monitorea la línea, asigna operadores y valida cierres de producción.',
  planner: 'Gestiona BOM, planifica órdenes y equilibra la carga de los centros.',
  plant_manager: 'Supervisa toda la operación, umbrales, reportes y equipo.',
  maintenance: 'Gestiona máquinas, tickets y mantenciones programadas.',
});

export const MODULE_GROUPS = Object.freeze([
  {
    label: 'Operación',
    modules: ['dashboard', 'orders', 'operator', 'supervision', 'maintenance'],
  },
  { label: 'Planificación', modules: ['bom', 'scheduling', 'line-balance', 'plant'] },
  { label: 'Sistema', modules: ['roles', 'admin-roles'] },
]);

export const ROLE_HOME_MODULE = Object.freeze({
  operator: 'operator',
  supervisor: 'supervision',
  planner: 'scheduling',
  plant_manager: 'dashboard',
  maintenance: 'maintenance',
});

/**
 * Páginas permitidas por rol. Un módulo fuera de esta matriz queda denegado.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const MODULE_ACCESS = Object.freeze({
  dashboard: ['supervisor', 'planner', 'plant_manager'],
  bom: ['planner', 'plant_manager'],
  orders: ['planner', 'plant_manager'],
  operator: ['operator', 'supervisor', 'plant_manager'],
  supervision: ['supervisor', 'plant_manager'],
  plant: ['supervisor', 'planner', 'plant_manager'],
  scheduling: ['operator', 'supervisor', 'planner', 'plant_manager', 'maintenance'],
  'line-balance': ['planner', 'plant_manager'],
  maintenance: ['supervisor', 'plant_manager', 'maintenance'],
  roles: ROLE_ORDER.filter((role) => role !== USER_ROLES.MAINTENANCE),
  'admin-roles': [ADMIN_ROLE],
});

/** @param {string} role */
export function normalizeRole(role) {
  return ROLE_ORDER.includes(role) ? role : DEFAULT_ROLE;
}

/** @param {string} role */
export function isAdmin(role) {
  return normalizeRole(role) === ADMIN_ROLE;
}

/**
 * @param {string} role
 * @param {string} moduleId
 */
export function isModuleAllowed(role, moduleId) {
  const allowed = MODULE_ACCESS[moduleId];
  if (!allowed) return false;
  return allowed.includes(normalizeRole(role));
}

/**
 * @param {string} role
 * @param {Array<{ id: string }>} modules
 */
export function modulesForRole(role, modules = []) {
  return modules.filter((module) =>
    isModuleAllowed(role, typeof module === 'string' ? module : module.id),
  );
}

/**
 * @param {string} role
 * @returns {string}
 */
export function homeModuleForRole(role) {
  const normalized = normalizeRole(role);
  const home = ROLE_HOME_MODULE[normalized];
  return isModuleAllowed(normalized, home) ? home : 'dashboard';
}
