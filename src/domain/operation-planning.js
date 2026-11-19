/**
 * @file Cálculo de tiempos estándar de operaciones y utilización de capacidad.
 * `planned_time_minutes = setup_time_minutes + run_time_per_unit_minutes × quantity`
 * La capacidad se deriva de `domain/capacity.js`; aquí se mantiene el horizonte
 * diario del panel de producción.
 */

import { effectiveDailyCapacity, loadRatio, round2 } from './capacity.js';

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
  return round2((operations || []).reduce((sum, op) => sum + plannedTimeMinutes(op, quantity), 0));
}

/**
 * Minutos de capacidad efectiva de un centro de trabajo en un día.
 * @param {import('./types.js').WorkCenter} workCenter
 * @returns {number|null} `null` si el centro no tiene capacidad válida
 */
export function effectiveCapacityPerDay(workCenter) {
  return effectiveDailyCapacity(workCenter);
}

/**
 * Utilización diaria de un centro (carga pendiente / capacidad de un día).
 * @param {number} loadMinutes
 * @param {import('./types.js').WorkCenter} workCenter
 * @returns {number|null} proporción ≥ 0 (puede superar 1), o `null` sin capacidad
 */
export function capacityUtilization(loadMinutes, workCenter) {
  return loadRatio(loadMinutes, effectiveCapacityPerDay(workCenter));
}
