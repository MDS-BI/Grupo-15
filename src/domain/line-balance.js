/**
 * @file Balance de líneas (US-11): tiempos estándar, carga proyectada,
 * utilización frente a capacidad nominal y cuellos de botella.
 * Ver contracts/line-balance.md §3 y §6.
 */

import { daysInPeriod } from './plant-performance.js';

function round2(value) {
  return Math.round(value * 100) / 100;
}

function toMillis(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function overlaps(period = {}, order) {
  const from = toMillis(period.from);
  const to = toMillis(period.to);
  if (from === null && to === null) return true;
  const start = toMillis(order.planned_start_date);
  const end = toMillis(order.planned_end_date) ?? start;
  if (start === null && end === null) return false;
  if (from !== null && end !== null && end < from) return false;
  if (to !== null && start !== null && start > to + 86399999) return false;
  return true;
}

/**
 * Agrupa tiempos estándar por centro de trabajo.
 * @param {Array<import('./types.js').RoutingOperation>} routingOperations
 */
export function computeStandardTimes(routingOperations = []) {
  const map = {};
  for (const op of routingOperations) {
    const setup = Number(op.setup_time_minutes);
    const run = Number(op.run_time_per_unit_minutes);
    if (!Number.isFinite(setup) || setup < 0 || !Number.isFinite(run) || run < 0) {
      throw new Error('Los tiempos estándar deben ser números mayores o iguales que 0.');
    }
    if (!map[op.work_center_id]) {
      map[op.work_center_id] = {
        setup_time_minutes: 0,
        run_time_per_unit_minutes: 0,
        operation_count: 0,
      };
    }
    map[op.work_center_id].setup_time_minutes += setup;
    map[op.work_center_id].run_time_per_unit_minutes += run;
    map[op.work_center_id].operation_count += 1;
  }
  return map;
}

/**
 * Carga proyectada por centro para un período. Las órdenes sin fechas se
 * excluyen y se reportan en `unscheduled_order_ids`.
 * @param {Array<import('./types.js').ProductionOrder>} orders
 * @param {Array<import('./types.js').RoutingOperation>} routingOperations
 * @param {{from?:string,to?:string}} [period]
 * @param {Array<import('./types.js').ProductionOrderOperation>} [orderOperations]
 */
export function computeProjectedLoad(
  orders = [],
  routingOperations = [],
  period = {},
  orderOperations = [],
) {
  const map = {};
  const unscheduled = [];
  const routingById = new Map();

  for (const op of routingOperations) {
    if (!routingById.has(op.routing_id)) routingById.set(op.routing_id, []);
    routingById.get(op.routing_id).push(op);
  }

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    if (!order.planned_start_date && !order.planned_end_date) {
      unscheduled.push(order.id);
      continue;
    }
    if (!overlaps(period, order)) continue;

    const frozen = orderOperations.filter((op) => op.production_order_id === order.id);
    const route = routingById.get(order.routing_id) || [];
    const source = frozen.length > 0 ? frozen : route;

    for (const op of source) {
      const planned = Number(op.planned_time_minutes);
      const load = Number.isFinite(planned)
        ? planned
        : (Number(op.setup_time_minutes) || 0) +
          (Number(op.run_time_per_unit_minutes) || 0) * (Number(order.quantity_planned) || 0);
      if (!map[op.work_center_id]) {
        map[op.work_center_id] = { load_minutes: 0, order_count: 0, order_ids: new Set() };
      }
      map[op.work_center_id].load_minutes += load;
      map[op.work_center_id].order_ids.add(order.id);
    }
  }

  const result = {};
  for (const [workCenterId, entry] of Object.entries(map)) {
    result[workCenterId] = {
      load_minutes: round2(entry.load_minutes),
      order_count: entry.order_ids.size,
    };
  }
  return { load_by_work_center: result, unscheduled_order_ids: unscheduled };
}

/**
 * Utilización frente a capacidad nominal del período.
 * @param {Object} loadByWorkCenter
 * @param {Array<import('./types.js').WorkCenter>} workCenters
 * @param {{from?:string,to?:string}} [period]
 */
export function computeUtilization(loadByWorkCenter = {}, workCenters = [], period = {}) {
  const days = daysInPeriod(period);
  return workCenters
    .map((wc) => {
      const load = Number(loadByWorkCenter[wc.id]?.load_minutes) || 0;
      const capacity = (Number(wc.capacity_per_day_minutes) || 0) * days;
      return {
        work_center_id: wc.id,
        name: wc.name,
        load_minutes: round2(load),
        capacity_minutes: round2(capacity),
        utilization: capacity === 0 ? null : round2(load / capacity),
        invalid_capacity: capacity === 0,
      };
    })
    .sort((a, b) => {
      const ua = a.utilization ?? -1;
      const ub = b.utilization ?? -1;
      if (ub !== ua) return ub - ua;
      return b.load_minutes - a.load_minutes;
    });
}

/**
 * Mayor utilización; desempate por carga y luego por id ascendente.
 * @param {Array<{work_center_id:string, load_minutes:number, utilization:number|null}>} rows
 */
export function detectBottlenecks(rows = []) {
  const valid = rows.filter((row) => row.utilization !== null && row.utilization !== undefined);
  if (valid.length === 0) return { bottleneck: null, candidates: [] };
  const maxUtilization = Math.max(...valid.map((row) => row.utilization));
  const candidates = valid.filter((row) => row.utilization === maxUtilization);
  const bottleneck = [...candidates].sort((a, b) => {
    if (b.load_minutes !== a.load_minutes) return b.load_minutes - a.load_minutes;
    return String(a.work_center_id).localeCompare(String(b.work_center_id));
  })[0];
  return { bottleneck, candidates };
}
