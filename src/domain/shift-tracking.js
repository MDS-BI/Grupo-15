/**
 * @file Reglas puras del turno del operador y atrasos justificados (US-06).
 * Ver contracts/operator-shift.md §3 y §5.
 */

import { OperationDelayStatus, ShiftStatus } from './types.js';

export function round2(value) {
  return Math.round(value * 100) / 100;
}

function toMillis(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Minutos transcurridos entre dos marcas ISO-8601.
 * @param {string} startedAt
 * @param {string} endedAt
 * @returns {number}
 */
export function elapsedMinutes(startedAt, endedAt) {
  const start = toMillis(startedAt);
  const end = toMillis(endedAt);
  if (start === null || end === null) {
    throw new Error('Las marcas de tiempo no son fechas válidas.');
  }
  if (end < start) {
    throw new Error('ended_at no puede ser anterior a started_at.');
  }
  return round2((end - start) / 60000);
}

/**
 * Suma de duraciones de atrasos cerrados.
 * @param {Array<import('./types.js').OperationDelay>} delays
 * @returns {number}
 */
export function sumClosedDelayMinutes(delays = []) {
  return round2(
    delays
      .filter((delay) => delay.status === OperationDelayStatus.CLOSED)
      .reduce((sum, delay) => sum + (Number(delay.duration_minutes) || 0), 0),
  );
}

/**
 * Tiempo efectivo = transcurrido − atrasos cerrados, nunca negativo.
 * @param {string} startedAt
 * @param {string} endedAt
 * @param {Array<import('./types.js').OperationDelay>} delays
 * @returns {number}
 */
export function computeEffectiveMinutes(startedAt, endedAt, delays = []) {
  return Math.max(0, round2(elapsedMinutes(startedAt, endedAt) - sumClosedDelayMinutes(delays)));
}

/** @param {Array<import('./types.js').OperationDelay>} delays */
export function hasOpenDelay(delays = []) {
  return delays.some((delay) => delay.status === OperationDelayStatus.OPEN);
}

/** @param {Array<import('./types.js').OperationDelay>} delays */
export function openDelayOf(delays = []) {
  return delays.find((delay) => delay.status === OperationDelayStatus.OPEN) || null;
}

/** @param {Array<import('./types.js').ProductionShift>} shifts */
export function activeShiftOf(shifts = [], operationId) {
  return (
    shifts.find(
      (shift) => shift.po_operation_id === operationId && shift.status === ShiftStatus.IN_PROGRESS,
    ) || null
  );
}

/**
 * Valida un contador de piezas y devuelve el número normalizado.
 * @param {unknown} value
 * @returns {number}
 */
export function validateCounter(value) {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    throw new Error('El contador debe ser un número válido.');
  }
  if (num < 0) {
    throw new Error('El contador no puede ser negativo.');
  }
  return num;
}

export function validateCumulative(value, planned) {
  const num = Number(value);
  const maximum = Number(planned);
  if (!Number.isFinite(num)) {
    throw new Error('El contador acumulado debe ser un número válido.');
  }
  if (!Number.isFinite(maximum) || maximum < 0) {
    throw new Error('La cantidad planificada de la orden no es válida.');
  }
  if (num < 0) {
    throw new Error('El contador acumulado no puede ser negativo.');
  }
  if (num > maximum) {
    throw new Error(`El contador acumulado no puede superar la cantidad planificada (${maximum}).`);
  }
  return num;
}

/**
 * Guarda de inicio de turno.
 * @param {import('./types.js').ProductionOrderOperation|null} operation
 * @param {import('./types.js').ProductionShift|null} activeShift
 * @param {{operator_id?:string|null, activeOperatorShift?:boolean}} [context]
 */
export function canStartShift(operation, activeShift, context = {}) {
  if (!operation) return false;
  if (operation.status === 'completed') return false;
  if (activeShift) return false;
  if (context.activeOperatorShift) return false;
  return true;
}

/**
 * Guarda de inicio de atraso.
 * @param {import('./types.js').ProductionOrderOperation|null} operation
 * @param {import('./types.js').OperationDelay|null} openDelay
 */
export function canStartDelay(operation, openDelay) {
  if (!operation || operation.status !== 'in_progress') return false;
  return !openDelay;
}
