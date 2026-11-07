/**
 * @file Snapshot versionado en `localStorage` (`erp.manufacturing.v2`) con
 * migración desde `erp.manufacturing.v1`. Ver contracts/maintenance.md §6.
 */

export const SNAPSHOT_KEY = 'erp.manufacturing.v2';
export const LEGACY_SNAPSHOT_KEY = 'erp.manufacturing.v1';
export const SNAPSHOT_VERSION = 2;

const COLLECTION_KEYS = [
  'companies',
  'unitsOfMeasure',
  'warehouses',
  'products',
  'salesOrders',
  'qualityInspections',
  'billOfMaterials',
  'bomComponents',
  'workCenters',
  'routings',
  'routingOperations',
  'productionOrders',
  'productionOrderOperations',
  'materialConsumption',
  'productionOutput',
  'productionShifts',
  'operationDelays',
  'delayReasons',
  'shiftAssignments',
  'hrEmployees',
  'maintenanceTickets',
  'preventiveMaintenanceOrders',
  'thresholdSettings',
  'rolePermissions',
];

const REQUIRED_ARRAYS = ['productionOrders', 'workCenters', 'productionOrderOperations'];

/** @returns {Storage|null} */
export function defaultStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasMinimalShape(payload) {
  if (!isPlainObject(payload)) return false;
  if (payload.version !== SNAPSHOT_VERSION) return false;
  if (!isPlainObject(payload.data)) return false;
  return REQUIRED_ARRAYS.every((key) => Array.isArray(payload.data[key]));
}

function normalizeData(data) {
  const normalized = {};
  for (const key of COLLECTION_KEYS) {
    normalized[key] = Array.isArray(data[key]) ? data[key] : [];
  }
  return normalized;
}

function normalizeSnapshot(payload) {
  return {
    version: SNAPSHOT_VERSION,
    savedAt: typeof payload.savedAt === 'string' ? payload.savedAt : new Date().toISOString(),
    data: normalizeData(payload.data),
  };
}

function isLegacySnapshot(payload) {
  return (
    isPlainObject(payload) &&
    (payload.version === 1 || payload.version === undefined) &&
    isPlainObject(payload.data)
  );
}

/**
 * Copia el estado de un snapshot `v1` y completa las colecciones nuevas vacías.
 * @param {{version?:number, savedAt?:string, data:Object}} legacy
 */
export function migrateV1ToV2(legacy) {
  return normalizeSnapshot({
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    data: {
      ...legacy.data,
      maintenanceTickets: legacy.data.maintenanceTickets || [],
      preventiveMaintenanceOrders: legacy.data.preventiveMaintenanceOrders || [],
      thresholdSettings: legacy.data.thresholdSettings || [],
      rolePermissions: legacy.data.rolePermissions || [],
    },
  });
}

/**
 * Carga el snapshot vigente, migrando `v1` si es necesario.
 * @param {Storage|null} [storage]
 * @param {{onWarning?:(message:string)=>void}} [options]
 * @returns {{version:number, savedAt:string, data:Object}|null}
 */
export function loadSnapshot(storage = defaultStorage(), { onWarning } = {}) {
  if (!storage) return null;

  const warn = (message) => {
    if (typeof onWarning === 'function') onWarning(message);
  };

  let rawV2 = null;
  try {
    rawV2 = storage.getItem(SNAPSHOT_KEY);
  } catch {
    return null;
  }

  if (rawV2 !== null && rawV2 !== undefined) {
    try {
      const parsed = JSON.parse(rawV2);
      if (hasMinimalShape(parsed)) return normalizeSnapshot(parsed);
      warn('El snapshot de manufactura v2 es inválido; se cargan los fixtures.');
    } catch {
      warn('El snapshot de manufactura v2 está corrupto; se cargan los fixtures.');
    }
  }

  let rawV1 = null;
  try {
    rawV1 = storage.getItem(LEGACY_SNAPSHOT_KEY);
  } catch {
    return null;
  }

  if (rawV1 !== null && rawV1 !== undefined) {
    try {
      const legacy = JSON.parse(rawV1);
      if (isLegacySnapshot(legacy)) {
        const migrated = migrateV1ToV2(legacy);
        saveSnapshot(migrated.data, storage);
        return migrated;
      }
      warn('El snapshot de manufactura v1 es inválido; se cargan los fixtures.');
    } catch {
      warn('El snapshot de manufactura v1 está corrupto; se cargan los fixtures.');
    }
  }

  return null;
}

/**
 * Escribe el snapshot `v2` con las colecciones indicadas.
 * @param {Object} data
 * @param {Storage|null} [storage]
 * @returns {boolean}
 */
export function saveSnapshot(data, storage = defaultStorage()) {
  if (!storage) return false;
  const payload = {
    version: SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    data: { ...data },
  };
  try {
    storage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Elimina el snapshot `v2` y, opcionalmente, el `v1`.
 * @param {Storage|null} [storage]
 * @param {{includeLegacy?:boolean}} [options]
 */
export function clearSnapshot(storage = defaultStorage(), { includeLegacy = false } = {}) {
  if (!storage) return;
  try {
    storage.removeItem(SNAPSHOT_KEY);
    if (includeLegacy) storage.removeItem(LEGACY_SNAPSHOT_KEY);
  } catch {
    /* almacenamiento no disponible */
  }
}
