/**
 * @file Balance de líneas (US-11): tiempos estándar, carga proyectada,
 * utilización frente a capacidad efectiva y estados de carga por centro.
 * Ver contracts/line-balance.md §3 y §6.
 */

export const TIGHT_FROM = 0.75;
export const BOTTLENECK_FROM = 0.95;

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

/** Días hábiles (lunes a viernes) inclusivos del período; mínimo 1. */
export function businessDaysInPeriod(period = {}) {
  const from = toMillis(period.from);
  const to = toMillis(period.to);
  if (from === null || to === null) return 1;
  const start = new Date(from);
  const end = new Date(to);
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let count = 0;
  while (cursor <= last) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.max(1, count);
}

/** Estado semántico de carga según utilización relativa a capacidad. */
export function utilizationStatus(utilization) {
  if (utilization === null || utilization === undefined) return 'unknown';
  const value = Number(utilization);
  if (!Number.isFinite(value)) return 'unknown';
  if (value >= BOTTLENECK_FROM) return 'bottleneck';
  if (value >= TIGHT_FROM) return 'tight';
  return 'normal';
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
  const byOrder = {};
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
      const workCenterId = op.work_center_id;
      if (!map[workCenterId]) {
        map[workCenterId] = { load_minutes: 0, order_minutes: {}, order_ids: [] };
      }
      map[workCenterId].load_minutes += load;
      if (!Object.hasOwn(map[workCenterId].order_minutes, order.id)) {
        map[workCenterId].order_minutes[order.id] = 0;
        map[workCenterId].order_ids.push(order.id);
      }
      map[workCenterId].order_minutes[order.id] += load;
      if (!byOrder[order.id]) byOrder[order.id] = [];
      byOrder[order.id].push({
        work_center_id: workCenterId,
        sequence: op.sequence ?? null,
        load_minutes: round2(load),
      });
    }
  }

  const result = {};
  for (const [workCenterId, entry] of Object.entries(map)) {
    result[workCenterId] = {
      load_minutes: round2(entry.load_minutes),
      order_count: entry.order_ids.length,
      order_ids: [...entry.order_ids],
      order_minutes: Object.fromEntries(
        Object.entries(entry.order_minutes).map(([orderId, minutes]) => [orderId, round2(minutes)]),
      ),
    };
  }
  return {
    load_by_work_center: result,
    load_operations_by_order: byOrder,
    unscheduled_order_ids: unscheduled,
  };
}

/**
 * Utilización frente a capacidad efectiva: días hábiles × min/día × eficiencia.
 * @param {Object} loadByWorkCenter
 * @param {Array<import('./types.js').WorkCenter>} workCenters
 * @param {{from?:string,to?:string}} [period]
 */
export function computeUtilization(loadByWorkCenter = {}, workCenters = [], period = {}) {
  const days = businessDaysInPeriod(period);
  return workCenters
    .map((wc) => {
      const load = Number(loadByWorkCenter[wc.id]?.load_minutes) || 0;
      const rawEfficiency = Number(wc.efficiency_factor);
      const efficiency = Number.isFinite(rawEfficiency) && rawEfficiency > 0 ? rawEfficiency : 1;
      const capacity = (Number(wc.capacity_per_day_minutes) || 0) * efficiency * days;
      const ratio = capacity === 0 ? null : load / capacity;
      return {
        work_center_id: wc.id,
        name: wc.name,
        load_minutes: round2(load),
        capacity_minutes: round2(capacity),
        utilization: ratio === null ? null : round2(ratio),
        status: utilizationStatus(ratio),
        slack_minutes: round2(capacity - load),
        business_days: days,
        efficiency_factor: efficiency,
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
 * Solo marca cuellos de botella cuando algún centro alcanza el umbral crítico.
 * Desempate: mayor utilización → mayor carga → id ascendente.
 * @param {Array<{work_center_id:string, load_minutes:number, utilization:number|null}>} rows
 */
export function detectBottlenecks(rows = []) {
  const critical = rows.filter(
    (row) =>
      row.utilization !== null &&
      row.utilization !== undefined &&
      row.utilization >= BOTTLENECK_FROM,
  );
  if (critical.length === 0) return { bottleneck: null, candidates: [] };
  const maxUtilization = Math.max(...critical.map((row) => row.utilization));
  const candidates = critical.filter((row) => row.utilization === maxUtilization);
  const bottleneck = [...candidates].sort((a, b) => {
    if (b.load_minutes !== a.load_minutes) return b.load_minutes - a.load_minutes;
    return String(a.work_center_id).localeCompare(String(b.work_center_id));
  })[0];
  return { bottleneck, candidates };
}

/** Indicadores agregados de la línea para el período. */
export function computeBalanceSummary(rows = []) {
  const valid = rows.filter((row) => row.utilization !== null && row.utilization !== undefined);
  const average = valid.length
    ? valid.reduce((sum, row) => sum + row.utilization, 0) / valid.length
    : null;
  const mostLoaded = [...valid].sort((a, b) => {
    if (b.utilization !== a.utilization) return b.utilization - a.utilization;
    return b.load_minutes - a.load_minutes;
  })[0];
  const totalLoad = rows.reduce((sum, row) => sum + row.load_minutes, 0);
  const maxLoad = Math.max(0, ...rows.map((row) => row.load_minutes));
  const efficiency = rows.length > 0 && maxLoad > 0 ? totalLoad / (rows.length * maxLoad) : null;
  const freeCapacity = rows.reduce((sum, row) => sum + Math.max(0, row.slack_minutes), 0);
  return {
    average_utilization: average === null ? null : round2(average),
    most_loaded: mostLoaded || null,
    balancing_efficiency: efficiency === null ? null : round2(efficiency),
    free_capacity_minutes: round2(freeCapacity),
    work_center_count: rows.length,
  };
}

/** Filas del detalle de una orden ordenadas por secuencia de ruta. */
export function computeOrderDetail(utilizationRows = [], projected = {}, orderId = '') {
  const operations = projected.load_operations_by_order?.[orderId] || [];
  const sequenceByCenter = {};
  for (const operation of operations) {
    const current = sequenceByCenter[operation.work_center_id];
    const next = operation.sequence;
    if (next === null || next === undefined) {
      if (current === undefined) sequenceByCenter[operation.work_center_id] = null;
      continue;
    }
    sequenceByCenter[operation.work_center_id] =
      current === undefined || current === null ? next : Math.min(current, next);
  }
  return utilizationRows
    .map((row) => ({ ...row, sequence: sequenceByCenter[row.work_center_id] ?? null }))
    .sort((a, b) => {
      if (a.sequence === null && b.sequence !== null) return 1;
      if (b.sequence === null && a.sequence !== null) return -1;
      if (a.sequence !== null && b.sequence !== null && a.sequence !== b.sequence) {
        return a.sequence - b.sequence;
      }
      return String(a.name).localeCompare(String(b.name), 'es');
    });
}

export function buildLineBalanceSuggestions(
  balance = {},
  operationsByOrder = {},
  workCenters = [],
  orders = [],
) {
  const bottleneck = balance.bottleneck;
  if (!bottleneck) return [];
  const fromId = bottleneck.work_center_id;
  const centerById = new Map(workCenters.map((center) => [center.id, center]));
  const orderNumberById = new Map(
    orders.map((order) => [order.id, order.order_number || order.id]),
  );
  const fromType = centerById.get(fromId)?.station_type;
  const rows = balance.utilization_by_work_center || [];
  const targets = fromType
    ? rows
        .filter(
          (row) =>
            row.work_center_id !== fromId &&
            centerById.get(row.work_center_id)?.station_type === fromType &&
            row.utilization !== null &&
            row.utilization !== undefined &&
            row.slack_minutes > 0,
        )
        .sort(
          (a, b) =>
            a.utilization - b.utilization ||
            b.slack_minutes - a.slack_minutes ||
            String(a.work_center_id).localeCompare(String(b.work_center_id)),
        )
    : [];
  const contributions = Object.entries(balance.load_by_work_center?.[fromId]?.order_minutes || {})
    .map(([orderId, minutes]) => ({ orderId, minutes: Number(minutes) || 0 }))
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  if (!contributions.length) return [];
  const operationsFor = (orderId) =>
    (operationsByOrder[orderId] || [])
      .filter(
        (op) => op.work_center_id === fromId && op.sequence !== null && op.sequence !== undefined,
      )
      .sort((a, b) => a.sequence - b.sequence);
  const nameOf = (id) => centerById.get(id)?.name || id;
  const minutesLabel = (value) =>
    round2(value).toLocaleString('es-CL', { maximumFractionDigits: 2 });
  const sequenceLabel = (sequence) =>
    sequence === null || sequence === undefined ? '' : ` · Sec. ${sequence}`;
  const usedTargets = new Set();
  const suggestions = [];
  for (const contribution of contributions.slice(0, 2)) {
    const target =
      targets.find(
        (row) => !usedTargets.has(row.work_center_id) && row.slack_minutes >= contribution.minutes,
      ) || targets.find((row) => !usedTargets.has(row.work_center_id));
    if (!target) continue;
    usedTargets.add(target.work_center_id);
    const minutes = Math.min(contribution.minutes, Math.max(0, target.slack_minutes));
    if (minutes <= 0) continue;
    const sequence = operationsFor(contribution.orderId)[0]?.sequence ?? null;
    const orderNumber = orderNumberById.get(contribution.orderId) || contribution.orderId;
    suggestions.push({
      suggestion_id: `reassign:${fromId}:${target.work_center_id}:${contribution.orderId}`,
      type: 'reassign',
      order_id: contribution.orderId,
      from_work_center_id: fromId,
      to_work_center_id: target.work_center_id,
      minutes: round2(minutes),
      sequence,
      label: `Reasignar ${minutesLabel(minutes)} min de ${orderNumber} desde ${nameOf(fromId)} a ${nameOf(target.work_center_id)}${sequenceLabel(sequence)}.`,
    });
  }
  const first = contributions[0];
  const firstSequence = operationsFor(first.orderId)[0]?.sequence ?? null;
  const firstOrderNumber = orderNumberById.get(first.orderId) || first.orderId;
  if (firstSequence !== null) {
    suggestions.push({
      suggestion_id: `sequence:${fromId}:${first.orderId}:${firstSequence}`,
      type: 'sequence',
      order_id: first.orderId,
      from_work_center_id: fromId,
      to_work_center_id: null,
      minutes: round2(first.minutes),
      sequence: firstSequence,
      label: `Revisar secuencia ${firstSequence} de ${firstOrderNumber} en ${nameOf(fromId)}.`,
    });
  }
  return suggestions.slice(0, 3);
}
