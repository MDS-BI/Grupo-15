/**
 * @file Control de acceso por rol de usuario.
 * Define los roles simulados del módulo, los módulos visibles y la matriz
 * de permisos por acción vigente (FR-13, FR-22 y FR-23).
 */

export const USER_ROLES = Object.freeze({
  OPERATOR: 'operator',
  SUPERVISOR: 'supervisor',
  PLANNER: 'planner',
  PRODUCTION_ENGINEER: 'production_engineer',
  PLANT_MANAGER: 'plant_manager',
  MAINTENANCE: 'maintenance',
});

export const ROLE_ORDER = Object.freeze([
  USER_ROLES.PLANT_MANAGER,
  USER_ROLES.PLANNER,
  USER_ROLES.PRODUCTION_ENGINEER,
  USER_ROLES.SUPERVISOR,
  USER_ROLES.OPERATOR,
  USER_ROLES.MAINTENANCE,
]);

export const DEFAULT_ROLE = USER_ROLES.PLANT_MANAGER;

export const ADMIN_ROLE = DEFAULT_ROLE;

export const ROLE_LABELS = Object.freeze({
  operator: 'Operador',
  supervisor: 'Supervisor de Línea',
  planner: 'Planificador',
  production_engineer: 'Ingeniero de Producción',
  plant_manager: 'Jefa de Planta',
  maintenance: 'Encargado de Mantenimiento',
});

export const ROLE_DESCRIPTIONS = Object.freeze({
  operator: 'Registra turnos, reporta atrasos e incidentes y consulta su estación.',
  supervisor: 'Monitorea la línea, asigna operadores y valida cierres de producción.',
  planner: 'Planifica órdenes, fechas y calendario de producción.',
  production_engineer: 'Edita BOM, rutas y analiza el balance de líneas.',
  plant_manager: 'Supervisa toda la operación, umbrales, reportes, roles y equipo.',
  maintenance: 'Gestiona máquinas, tickets y mantenciones programadas.',
});

export const MODULE_GROUPS = Object.freeze([
  {
    label: 'Operación',
    modules: ['dashboard', 'orders', 'operator', 'supervision', 'maintenance'],
  },
  {
    label: 'Planificación',
    modules: ['bom', 'scheduling', 'line-balance', 'plant'],
  },
  { label: 'Sistema', modules: ['roles'] },
]);

export const ROLE_HOME_MODULE = Object.freeze({
  operator: 'operator',
  supervisor: 'supervision',
  planner: 'scheduling',
  production_engineer: 'line-balance',
  plant_manager: 'plant',
  maintenance: 'maintenance',
});

/**
 * Páginas permitidas por rol. Un módulo fuera de esta matriz queda denegado.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const MODULE_ACCESS = Object.freeze({
  dashboard: ['plant_manager', 'planner', 'production_engineer', 'supervisor'],
  bom: ['plant_manager', 'planner', 'production_engineer'],
  orders: ['plant_manager', 'planner'],
  operator: ['plant_manager', 'supervisor', 'operator'],
  supervision: ['plant_manager', 'supervisor'],
  plant: ['plant_manager', 'planner', 'production_engineer', 'supervisor'],
  scheduling: ['plant_manager', 'planner', 'supervisor', 'operator', 'maintenance'],
  'line-balance': ['plant_manager', 'planner', 'production_engineer'],
  maintenance: ['plant_manager', 'supervisor', 'maintenance'],
  roles: [ADMIN_ROLE],
  'admin-roles': [ADMIN_ROLE],
});

const ALL = [...ROLE_ORDER];
const MANAGER = USER_ROLES.PLANT_MANAGER;
const PLANNER = USER_ROLES.PLANNER;
const ENGINEER = USER_ROLES.PRODUCTION_ENGINEER;
const SUPERVISOR = USER_ROLES.SUPERVISOR;
const OPERATOR = USER_ROLES.OPERATOR;
const MAINTENANCE = USER_ROLES.MAINTENANCE;

function access(entries) {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(entries).map(([action, roles]) => [action, Object.freeze(roles)]),
    ),
  );
}

/**
 * Matriz canónica de FR-22. Las claves usan el módulo canónico y la acción.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const ACTION_ACCESS = Object.freeze(
  access({
    'panel.ver': ALL,
    'panel.crear': [MANAGER],
    'panel.editar': [MANAGER],
    'panel.aprobar': [],
    'panel.exportar': [MANAGER, PLANNER, ENGINEER, SUPERVISOR],
    'panel.configurar': [MANAGER],
    'bom.ver': [MANAGER, PLANNER, ENGINEER, SUPERVISOR, OPERATOR],
    'bom.crear': [MANAGER, ENGINEER],
    'bom.editar': [MANAGER, ENGINEER],
    'bom.aprobar': [MANAGER],
    'bom.exportar': [MANAGER, PLANNER, ENGINEER],
    'bom.configurar': [],
    'orders.ver': [MANAGER, PLANNER, ENGINEER, SUPERVISOR],
    'orders.crear': [MANAGER, PLANNER],
    'orders.editar': [MANAGER, PLANNER],
    'orders.aprobar': [MANAGER, PLANNER],
    'orders.exportar': [MANAGER, PLANNER, ENGINEER],
    'orders.configurar': [],
    'estacion.ver': [MANAGER, SUPERVISOR, OPERATOR],
    'estacion.crear': [MANAGER, SUPERVISOR, OPERATOR],
    'estacion.editar': [MANAGER, SUPERVISOR, OPERATOR],
    'estacion.aprobar': [MANAGER, SUPERVISOR],
    'estacion.exportar': [],
    'estacion.configurar': [],
    'supervision.ver': [MANAGER, SUPERVISOR],
    'supervision.crear': [MANAGER, SUPERVISOR],
    'supervision.editar': [MANAGER, SUPERVISOR],
    'supervision.aprobar': [MANAGER, SUPERVISOR],
    'supervision.exportar': [MANAGER],
    'supervision.configurar': [],
    'planificacion.ver': ALL,
    'planificacion.crear': [MANAGER, PLANNER],
    'planificacion.editar': [MANAGER, PLANNER],
    'planificacion.aprobar': [MANAGER, MAINTENANCE],
    'planificacion.exportar': [MANAGER, PLANNER],
    'planificacion.configurar': [],
    'balance.ver': [MANAGER, PLANNER, ENGINEER, SUPERVISOR],
    'balance.crear': [MANAGER, ENGINEER],
    'balance.editar': [MANAGER, ENGINEER],
    'balance.aprobar': [],
    'balance.exportar': [MANAGER, ENGINEER],
    'balance.configurar': [],
    'mantenimiento.ver': [MANAGER, SUPERVISOR, OPERATOR, MAINTENANCE],
    'mantenimiento.crear': [MANAGER, SUPERVISOR, OPERATOR, MAINTENANCE],
    'mantenimiento.editar': [MANAGER, MAINTENANCE],
    'mantenimiento.aprobar': [MANAGER, MAINTENANCE],
    'mantenimiento.exportar': [MANAGER, MAINTENANCE],
    'mantenimiento.configurar': [],
    'roles.ver': [MANAGER],
    'roles.crear': [MANAGER],
    'roles.editar': [MANAGER],
    'roles.aprobar': [MANAGER],
    'roles.exportar': [MANAGER],
    'roles.configurar': [MANAGER],
  }),
);

const ACTION_ALIASES = Object.freeze({
  dashboard: 'panel',
  plant: 'panel',
  operator: 'estacion',
  scheduling: 'planificacion',
  'line-balance': 'balance',
  maintenance: 'mantenimiento',
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
  if (!ROLE_ORDER.includes(role)) return false;
  const allowed = MODULE_ACCESS[moduleId];
  if (!allowed) return false;
  return allowed.includes(role);
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

/**
 * Resuelve una acción de la matriz, aceptando los alias de módulos de la UI.
 * @param {string} action
 */
export function actionKeyFor(action) {
  const key = String(action ?? '');
  const separator = key.indexOf('.');
  if (separator < 0) return key;
  const moduleId = key.slice(0, separator);
  return `${ACTION_ALIASES[moduleId] ?? moduleId}.${key.slice(separator + 1)}`;
}

/**
 * @param {string|null|undefined} role rol resuelto en el login
 * @param {string} action par módulo/acción de FR-22
 * @returns {boolean}
 */
export function can(role, action) {
  const resolved = role ?? DEFAULT_ROLE;
  if (!ROLE_ORDER.includes(resolved)) return false;
  return Boolean(ACTION_ACCESS[actionKeyFor(action)]?.includes(resolved));
}
