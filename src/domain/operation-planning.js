/**
 * @file Cálculo de tiempos estándar de operaciones y utilización de capacidad.
 * `planned_time_minutes = setup_time_minutes + run_time_per_unit_minutes × quantity`
 */

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round4(n) {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/**
 * @param {import('./types.js').RoutingOperation} operation
 * @param {number} quantity
 * @returns {number} minutos planificados redondeados a 2 decimales
 */
export function plannedTimeMinutes(operation, quantity) {
  const setup = Number(operation?.setup_time_minutes) || 0;
  const run = Number(operation?.run_time_per_unit_minutes) || 0;
  const qty = Number(quantity) || 0;
  return round2(setup + run * qty);
}

/**
 * Tiempo estándar total de una ruta para una cantidad dada.
 * @param {import('./types.js').RoutingOperation[]} operations
 * @param {number} quantity
 * @returns {number}
 */
export function totalPlannedTime(operations, quantity) {
  return round2(
    (operations || []).reduce((sum, op) => sum + plannedTimeMinutes(op, quantity), 0)
  );
}

/**
 * Minutos de capacidad efectiva de un centro de trabajo en un día.
 * @param {import('./types.js').WorkCenter} workCenter
 * @returns {number}
 */
export function effectiveCapacityPerDay(workCenter) {
  const capacity = Number(workCenter?.capacity_per_day_minutes) || 0;
  const efficiency = Number(workCenter?.efficiency_factor);
  const factor = Number.isFinite(efficiency) && efficiency > 0 ? efficiency : 1;
  return round2(capacity * factor);
}

/**
 * Utilización de un centro de trabajo como proporción (carga / capacidad).
 * @param {number} loadMinutes
 * @param {import('./types.js').WorkCenter} workCenter
 * @returns {number} valor ≥ 0 (puede superar 1 en sobrecarga)
 */
export function capacityUtilization(loadMinutes, workCenter) {
  const capacity = effectiveCapacityPerDay(workCenter);
  if (capacity <= 0) return 0;
  return round4(loadMinutes / capacity);
}
