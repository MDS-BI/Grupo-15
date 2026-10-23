/**
 * @file Helpers de formato y render compartidos por las vistas.
 */

/** @param {number} n */
export function fmtNumber(n, decimals = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** @param {number} ratio */
export function fmtPercent(ratio, decimals = 1) {
  const v = Number(ratio);
  if (!Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(decimals)}%`;
}

/** @param {string} value */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Etiquetas en español para los estados de orden. */
export const ORDER_STATUS_LABEL = {
  planned: 'Planificada',
  released: 'Liberada',
  in_progress: 'En Proceso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

/** Etiquetas en español para los estados de operación. */
export const OP_STATUS_LABEL = {
  pending: 'Pendiente',
  in_progress: 'En Proceso',
  paused: 'Pausada',
  completed: 'Completada',
};

/** Etiquetas para el estado de calidad derivado. */
export const QUALITY_LABEL = {
  none: 'Sin Inspección',
  pending: 'Pendiente',
  passed: 'Aprobada',
  failed: 'Rechazada',
};

/** @param {string} status */
export function orderStatusBadge(status) {
  return `<span class="badge badge--${status}">${ORDER_STATUS_LABEL[status] || status}</span>`;
}

/**
 * Crea un elemento a partir de HTML y lo devuelve.
 * @param {string} html
 * @returns {HTMLElement}
 */
export function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return /** @type {HTMLElement} */ (tpl.content.firstElementChild);
}
