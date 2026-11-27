/**
 * @file Snapshot versionado en `localStorage` (`erp.manufacturing.v2`) con
 * migración desde `erp.manufacturing.v1`. Ver contracts/maintenance.md §6.
 */

import { billOfMaterials, bomComponents } from './fixtures/boms.js';
import { delayReasons } from './fixtures/delay-reasons.js';
import {
  companies,
  products,
  qualityInspections,
  salesOrders,
  unitsOfMeasure,
  warehouses,
} from './fixtures/master-data.js';
import { maintenanceTickets } from './fixtures/maintenance-tickets.js';
import { hrEmployees } from './fixtures/hr-employees.js';
import { thresholdSettings, rolePermissions } from './fixtures/plant-performance.js';
import { ROLE_USERS, ROLE_USER_COLLECTION_KEYS } from './fixtures/demo-accounts.js';
import { preventiveMaintenanceOrders } from './fixtures/preventive-maintenance-orders.js';
import {
  materialConsumption,
  orderStations,
  productionOrderOperations,
  productionOrders,
  productionOutput,
} from './fixtures/production-orders.js';
import { operationDelays, productionShifts } from './fixtures/production-shifts.js';
import { routings, routingOperations } from './fixtures/routings.js';
import { shiftAssignments } from './fixtures/shift-assignments.js';
import { workCenters } from './fixtures/work-centers.js';

export const SNAPSHOT_KEY = 'erp.manufacturing.v2';
export const LEGACY_SNAPSHOT_KEY = 'erp.manufacturing.v1';
export const SNAPSHOT_VERSION = 2;
export const ROLE_ACCESS_SCHEMA_VERSION = 2;

const LEGACY_ROLE_USERNAMES = new Set(['usuario', 'test', 'doble']);

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
  'order_stations',
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
  ...Object.values(ROLE_USER_COLLECTION_KEYS),
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function isoDatePart(value) {
  if (typeof value !== 'string') return null;
  if (ISO_DATE.test(value)) return value;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T/);
  return match ? match[1] : null;
}

function normalizeWorkCenter(workCenter) {
  if (!isPlainObject(workCenter)) return workCenter;
  const days = Number(workCenter.recommended_maintenance_frequency_days);
  return {
    ...workCenter,
    recommended_maintenance_frequency_days:
      Number.isFinite(days) && days >= 1 ? Math.round(days) : null,
  };
}

function normalizeProductionOrder(order) {
  if (!isPlainObject(order)) return order;
  return {
    ...order,
    is_critical_urgent:
      typeof order.is_critical_urgent === 'boolean' ? order.is_critical_urgent : false,
    scheduled_start_time:
      typeof order.scheduled_start_time === 'string' && TIME_HH_MM.test(order.scheduled_start_time)
        ? order.scheduled_start_time
        : '08:00',
    scheduled_end_time:
      typeof order.scheduled_end_time === 'string' && TIME_HH_MM.test(order.scheduled_end_time)
        ? order.scheduled_end_time
        : '16:00',
  };
}

function normalizeMaintenanceTicket(ticket) {
  if (!isPlainObject(ticket)) return ticket;
  const derivedDate = isoDatePart(ticket.created_at);
  return {
    ...ticket,
    scheduled_start_date: isoDatePart(ticket.scheduled_start_date) || derivedDate,
    scheduled_end_date: isoDatePart(ticket.scheduled_end_date) || derivedDate,
  };
}

function normalizePreventiveOrder(order) {
  if (!isPlainObject(order)) return order;
  const derivedDate = isoDatePart(order.planned_date);
  return {
    ...order,
    scheduled_start_date: isoDatePart(order.scheduled_start_date) || derivedDate,
    scheduled_end_date: isoDatePart(order.scheduled_end_date) || derivedDate,
  };
}

function normalizeData(data) {
  const normalized = {};
  for (const key of COLLECTION_KEYS) {
    if (!Array.isArray(data[key])) {
      normalized[key] = [];
      continue;
    }
    if (key === 'productionOrders') {
      normalized[key] = data[key].map(normalizeProductionOrder);
    } else if (key === 'workCenters') {
      normalized[key] = data[key].map(normalizeWorkCenter);
    } else if (key === 'maintenanceTickets') {
      normalized[key] = data[key].map(normalizeMaintenanceTicket);
    } else if (key === 'preventiveMaintenanceOrders') {
      normalized[key] = data[key].map(normalizePreventiveOrder);
    } else {
      normalized[key] = data[key];
    }
  }
  normalized.roleAccessSchema = ROLE_ACCESS_SCHEMA_VERSION;
  for (const key of Object.values(ROLE_USER_COLLECTION_KEYS)) {
    normalized[key] = normalized[key].filter(
      (row) =>
        !LEGACY_ROLE_USERNAMES.has(
          String(row?.username ?? '')
            .trim()
            .toLowerCase(),
        ),
    );
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
      ...Object.fromEntries(
        Object.values(ROLE_USER_COLLECTION_KEYS).map((key) => [key, legacy.data[key] || []]),
      ),
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

function cloneFixture(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createFixtureSnapshot() {
  return normalizeData({
    companies: cloneFixture(companies),
    unitsOfMeasure: cloneFixture(unitsOfMeasure),
    warehouses: cloneFixture(warehouses),
    products: cloneFixture(products),
    salesOrders: cloneFixture(salesOrders),
    qualityInspections: cloneFixture(qualityInspections),
    billOfMaterials: cloneFixture(billOfMaterials),
    bomComponents: cloneFixture(bomComponents),
    workCenters: cloneFixture(workCenters),
    routings: cloneFixture(routings),
    routingOperations: cloneFixture(routingOperations),
    productionOrders: cloneFixture(productionOrders),
    productionOrderOperations: cloneFixture(productionOrderOperations),
    order_stations: cloneFixture(orderStations),
    materialConsumption: cloneFixture(materialConsumption),
    productionOutput: cloneFixture(productionOutput),
    maintenanceTickets: cloneFixture(maintenanceTickets),
    preventiveMaintenanceOrders: cloneFixture(preventiveMaintenanceOrders),
    productionShifts: cloneFixture(productionShifts),
    operationDelays: cloneFixture(operationDelays),
    delayReasons: cloneFixture(delayReasons),
    shiftAssignments: cloneFixture(shiftAssignments),
    hrEmployees: cloneFixture(hrEmployees),
    thresholdSettings: cloneFixture(thresholdSettings),
    rolePermissions: cloneFixture(rolePermissions),
    ...Object.fromEntries(
      Object.entries(ROLE_USER_COLLECTION_KEYS).map(([role, key]) => [
        key,
        cloneFixture(ROLE_USERS[role]),
      ]),
    ),
  });
}

export function resetDemoSnapshot(storage = defaultStorage()) {
  clearSnapshot(storage, { includeLegacy: true });
  return saveSnapshot(createFixtureSnapshot(), storage);
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
