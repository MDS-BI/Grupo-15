/**
 * @file Reglas puras de planificación y calendarización de órdenes (US-10).
 * Ver contracts/order-scheduling.md §3.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };

/**
 * Acepta `null` o una fecha `YYYY-MM-DD` que exista en el calendario.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidIsoDate(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * @param {{planned_start_date?:string|null, planned_end_date?:string|null}} dates
 * @returns {{valid:boolean, error?:string}}
 */
export function validatePlannedDates({ planned_start_date, planned_end_date } = {}) {
  if (!isValidIsoDate(planned_start_date) || !isValidIsoDate(planned_end_date)) {
    return { valid: false, error: 'fecha_invalida' };
  }
  if (
    planned_start_date &&
    planned_end_date &&
    String(planned_end_date) < String(planned_start_date)
  ) {
    return { valid: false, error: 'rango_invertido' };
  }
  return { valid: true };
}

/** @param {import('./types.js').ProductionOrder|null} order */
export function canRescheduleOrder(order) {
  if (!order) return false;
  return order.status !== 'completed' && order.status !== 'cancelled';
}

/**
 * Ordena por inicio planificado (nulos al final), prioridad y número de orden.
 * @param {Array<import('./types.js').ProductionOrder>} orders
 */
export function sortOrdersForScheduling(orders = []) {
  return [...orders].sort((a, b) => {
    const aDate = a.planned_start_date || '';
    const bDate = b.planned_start_date || '';
    if (aDate !== bDate) {
      if (!aDate) return 1;
      if (!bDate) return -1;
      return aDate.localeCompare(bDate);
    }
    const aRank = PRIORITY_RANK[a.priority] ?? 99;
    const bRank = PRIORITY_RANK[b.priority] ?? 99;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.order_number).localeCompare(String(b.order_number));
  });
}
