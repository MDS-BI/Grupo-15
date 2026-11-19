/**
 * @file Indicadores consolidados del panel de planta (US-08).
 * Ver contracts/plant-performance.md §3 y §6. Funciones puras: el período y el
 * instante de corte siempre se reciben como argumentos. La capacidad se deriva
 * de `domain/capacity.js`; la carga observada es propia de este caso de uso.
 */

import { businessDaysInPeriod, capacityFor, loadRatio, round2 } from './capacity.js';

export { businessDaysInPeriod as daysInPeriod, round2 };

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function toMillis(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function inPeriod(value, period = {}) {
  const at = toMillis(value);
  if (at === null) return false;
  const from = toMillis(period.from);
  const to = toMillis(period.to);
  if (from !== null && at < from) return false;
  if (to !== null && at > to + 86399999) return false;
  return true;
}

/** Las operaciones sin marcas de tiempo no se pueden fechar: se incluyen. */
function inPeriodOrUndated(value, period = {}) {
  if (!value) return true;
  return inPeriod(value, period);
}

/**
 * OEE por centro: disponibilidad × rendimiento × calidad.
 * @param {string} workCenterId
 * @param {Array<Object>} operations Operaciones enriquecidas con cantidad y tiempo estándar.
 * @param {Array<import('./types.js').OperationDelay>} delays
 * @param {{from?:string,to?:string}} [period]
 */
export function computeOee(workCenterId, operations = [], delays = [], period = {}) {
  const ops = operations.filter(
    (op) =>
      op.work_center_id === workCenterId &&
      inPeriodOrUndated(op.completed_at || op.started_at, period),
  );
  if (ops.length === 0) return null;

  const planned = ops.reduce((sum, op) => sum + (Number(op.planned_time_minutes) || 0), 0);
  if (planned <= 0) return null;

  const opIds = new Set(ops.map((op) => op.id));
  const downtime = delays
    .filter(
      (delay) =>
        opIds.has(delay.po_operation_id) &&
        delay.status === 'closed' &&
        inPeriod(delay.ended_at || delay.started_at, period),
    )
    .reduce((sum, delay) => sum + (Number(delay.duration_minutes) || 0), 0);

  const availability = clamp((planned - downtime) / planned);

  let performance = null;
  let quality = null;
  let quantityCompleted = 0;
  let quantityScrap = 0;
  let standardMinutes = 0;
  let standardKnown = true;
  for (const op of ops) {
    quantityCompleted += Number(op.quantity_completed) || 0;
    quantityScrap += Number(op.scrap_quantity) || 0;
    const run = Number(op.run_time_per_unit_minutes);
    const qty = Number(op.quantity_planned);
    if (!Number.isFinite(run) || !Number.isFinite(qty)) standardKnown = false;
    else standardMinutes += run * qty;
  }
  if (standardKnown && standardMinutes > 0) {
    performance = clamp(quantityCompleted / standardMinutes);
  }
  if (quantityCompleted + quantityScrap > 0) {
    quality = clamp(quantityCompleted / (quantityCompleted + quantityScrap));
  }

  const oee =
    performance === null || quality === null ? null : clamp(availability * performance * quality);

  return { availability, performance, quality, oee };
}

/**
 * Carga vs. capacidad efectiva por centro (incluye centros desactivados).
 * @param {Array<import('./types.js').WorkCenter>} workCenters
 * @param {Array<Object>} operations
 * @param {{from?:string,to?:string}} [period]
 */
export function computeLoadByWorkCenter(workCenters = [], operations = [], period = {}) {
  const map = {};
  for (const wc of workCenters) {
    const load = operations
      .filter(
        (op) =>
          op.work_center_id === wc.id &&
          inPeriodOrUndated(op.completed_at || op.started_at, period),
      )
      .reduce((sum, op) => sum + (Number(op.planned_time_minutes) || 0), 0);
    const capacity = capacityFor(wc, period);
    map[wc.id] = {
      load_minutes: round2(load),
      capacity_minutes: capacity.capacity_minutes,
      load_ratio: loadRatio(load, capacity.capacity_minutes),
      business_days: capacity.business_days,
      invalid_capacity: capacity.invalid_capacity,
      inactive: wc.status !== 'active',
    };
  }
  return map;
}

/**
 * Paradas acumuladas por motivo, sin duplicar el mismo evento de parada.
 * @param {Array<import('./types.js').OperationDelay>} delays
 * @param {Array<import('./types.js').MaintenanceTicket>} maintenanceTickets
 * @param {{from?:string,to?:string}} [period]
 * @param {Array<import('./types.js').DelayReason>} [reasons]
 */
export function accumulateDowntimesByReason(
  delays = [],
  maintenanceTickets = [],
  period = {},
  reasons = [],
) {
  const labels = new Map(reasons.map((reason) => [reason.id, reason.label]));
  const totals = new Map();
  const countedDelayIds = new Set();

  for (const delay of delays) {
    if (delay.status !== 'closed') continue;
    if (!inPeriod(delay.ended_at || delay.started_at, period)) continue;
    const id = delay.delay_reason_id;
    totals.set(id, (totals.get(id) || 0) + (Number(delay.duration_minutes) || 0));
    if (delay.id) countedDelayIds.add(delay.id);
  }

  for (const ticket of maintenanceTickets) {
    if (ticket.ticket_status !== 'resolved') continue;
    if (!inPeriod(ticket.resolved_at, period)) continue;
    if (ticket.operation_delay_id && countedDelayIds.has(ticket.operation_delay_id)) continue;
    const id = ticket.cause_reason_id || 'sin_clasificar';
    let minutes = Number(ticket.downtime_minutes);
    if (!Number.isFinite(minutes)) {
      const start = toMillis(ticket.downtime_started_at);
      const end = toMillis(ticket.downtime_ended_at);
      minutes = start !== null && end !== null ? Math.max(0, (end - start) / 60000) : 0;
    }
    totals.set(id, (totals.get(id) || 0) + minutes);
  }

  return [...totals.entries()]
    .map(([reason_id, downtime_minutes]) => ({
      reason_id,
      reason_label: labels.get(reason_id) || reason_id,
      downtime_minutes: round2(downtime_minutes),
    }))
    .sort((a, b) => b.downtime_minutes - a.downtime_minutes);
}

/**
 * Compara indicadores contra sus umbrales. No muta la configuración.
 * @param {Object} indicators
 * @param {Array<import('./types.js').ThresholdSetting>} thresholdSettings
 */
export function evaluateThresholds(indicators = {}, thresholdSettings = []) {
  const keys = new Set([...Object.keys(indicators), ...thresholdSettings.map((s) => s.indicator)]);
  return [...keys].map((indicator) => {
    const setting = thresholdSettings.find((row) => row.indicator === indicator) || null;
    const value = indicators[indicator];
    if (!setting || value === undefined || value === null) {
      return {
        indicator,
        threshold: null,
        comparison: null,
        value: value ?? null,
        breached: false,
      };
    }
    const breached =
      setting.comparison === 'gt' ? value > setting.threshold : value < setting.threshold;
    return {
      indicator,
      threshold: setting.threshold,
      comparison: setting.comparison,
      value,
      breached,
    };
  });
}

/**
 * Deny by default: sin fila (rol, acción) la acción no está permitida.
 * @param {string} role
 * @param {string} action
 * @param {Array<import('./types.js').RolePermission>} rolePermissions
 */
export function canPerformAction(role, action, rolePermissions = []) {
  const row = rolePermissions.find((entry) => entry.role === role && entry.action === action);
  return Boolean(row && row.allowed);
}

/**
 * Compone el reporte consolidado serializable (sin datos por operador).
 * @param {{from?:string,to?:string,label?:string}} period
 * @param {Object} data
 */
export function buildConsolidatedReport(period = {}, data = {}) {
  return {
    period: {
      from: period.from || null,
      to: period.to || null,
      label: period.label || `${period.from || 'inicio'} → ${period.to || 'hoy'}`,
    },
    generated_at: data.generated_at || null,
    load_by_work_center: data.load_by_work_center || {},
    oee_by_work_center: data.oee_by_work_center || {},
    downtime_by_reason: data.downtime_by_reason || [],
    fulfillment: data.fulfillment || { completed_on_time: 0, total_with_due_date: 0, ratio: null },
    thresholds: data.thresholds || [],
  };
}
