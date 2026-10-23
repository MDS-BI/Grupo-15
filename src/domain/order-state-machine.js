/**
 * @file Máquina de estados de `production_orders`.
 * Transiciones: planned → released → in_progress → completed; `cancelled` es
 * lateral desde cualquier estado no terminal. Las transiciones inversas se
 * rechazan explícitamente.
 */

import { ProductionOrderStatus as S } from './types.js';

/** @type {Record<string, string[]>} */
export const TRANSITIONS = Object.freeze({
  [S.PLANNED]: [S.RELEASED, S.CANCELLED],
  [S.RELEASED]: [S.IN_PROGRESS, S.CANCELLED],
  [S.IN_PROGRESS]: [S.COMPLETED, S.CANCELLED],
  [S.COMPLETED]: [],
  [S.CANCELLED]: [],
});

/** Estados terminales: sin salida. */
export const TERMINAL_STATES = Object.freeze([S.COMPLETED, S.CANCELLED]);

/** @param {string} status @returns {boolean} */
export function isTerminal(status) {
  return TERMINAL_STATES.includes(status);
}

/**
 * Indica si la transición `from → to` está permitida.
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Valida y devuelve el siguiente estado, o lanza un error descriptivo.
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
export function assertTransition(from, to) {
  if (from === to) return to;
  if (!canTransition(from, to)) {
    throw new Error(
      `Transición de orden inválida: "${from}" → "${to}". ` +
        `Estados permitidos desde "${from}": ${(TRANSITIONS[from] || []).join(', ') || 'ninguno'}.`
    );
  }
  return to;
}

/**
 * Estados siguientes válidos para poblar la UI.
 * @param {string} from
 * @returns {string[]}
 */
export function nextStatuses(from) {
  return [...(TRANSITIONS[from] || [])];
}

/**
 * Deriva el estado de una orden a partir del estado de sus operaciones.
 * - Ninguna operación iniciada → `released`
 * - Alguna en progreso/pausada/finalizada, pero no todas → `in_progress`
 * - Todas completadas → `completed`
 * @param {Array<{status: string}>} operations
 * @returns {string}
 */
export function deriveOrderStatus(operations) {
  if (!operations || operations.length === 0) return S.RELEASED;
  const completed = operations.filter((o) => o.status === 'completed').length;
  if (completed === operations.length) return S.COMPLETED;
  const started = operations.some(
    (o) => o.status === 'in_progress' || o.status === 'paused' || o.status === 'completed'
  );
  return started ? S.IN_PROGRESS : S.RELEASED;
}
