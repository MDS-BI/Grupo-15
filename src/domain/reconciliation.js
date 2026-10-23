/**
 * @file Reconciliación plan-vs-real entre `bom_components` (teórico) y
 * `material_consumption` (real). Ver plan.md §4.2.
 */

/** Tolerancia por defecto (±5%). */
export const DEFAULT_TOLERANCE = 0.05;

function round6(n) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

/**
 * @typedef {Object} ConsumptionVariance
 * @property {string} component_product_id
 * @property {number} theoretical_quantity
 * @property {number} actual_quantity
 * @property {number} variance  actual − theoretical
 * @property {number} variance_ratio  variance / theoretical (0 si teórico = 0)
 * @property {'ok'|'over'|'under'|'unplanned'} flag
 * @property {boolean} within_tolerance
 */

/**
 * Compara el consumo real con el teórico para una orden.
 * @param {Object} args
 * @param {Array<import('./types.js').BomComponent>} args.bomComponents
 * @param {Array<import('./types.js').MaterialConsumption>} args.consumptions
 * @param {number} args.quantityPlanned
 * @param {number} [args.tolerance]
 * @returns {ConsumptionVariance[]}
 */
export function reconcileConsumption({
  bomComponents,
  consumptions,
  quantityPlanned,
  tolerance = DEFAULT_TOLERANCE,
}) {
  const byComponent = new Map();

  for (const c of bomComponents || []) {
    const theoretical =
      (Number(c.quantity_per_unit) || 0) *
      (1 + (Number(c.scrap_percentage) || 0) / 100) *
      (Number(quantityPlanned) || 0);
    byComponent.set(c.component_product_id, {
      component_product_id: c.component_product_id,
      theoretical_quantity: round6(theoretical),
      actual_quantity: 0,
    });
  }

  for (const consumption of consumptions || []) {
    const key = consumption.component_product_id;
    const entry = byComponent.get(key);
    if (entry) {
      entry.actual_quantity = round6(
        entry.actual_quantity + (Number(consumption.quantity_consumed) || 0)
      );
    } else {
      byComponent.set(key, {
        component_product_id: key,
        theoretical_quantity: 0,
        actual_quantity: round6(Number(consumption.quantity_consumed) || 0),
      });
    }
  }

  const result = [];
  for (const entry of byComponent.values()) {
    const variance = round6(entry.actual_quantity - entry.theoretical_quantity);
    const ratio =
      entry.theoretical_quantity > 0 ? round6(variance / entry.theoretical_quantity) : 0;

    let flag = 'ok';
    if (entry.theoretical_quantity === 0) flag = 'unplanned';
    else if (variance > 0) flag = 'over';
    else if (variance < 0) flag = 'under';

    const within =
      entry.theoretical_quantity === 0 ? false : Math.abs(ratio) <= tolerance;

    result.push({
      component_product_id: entry.component_product_id,
      theoretical_quantity: entry.theoretical_quantity,
      actual_quantity: entry.actual_quantity,
      variance,
      variance_ratio: ratio,
      flag,
      within_tolerance: within,
    });
  }
  return result;
}

/**
 * Indica si la reconciliación requiere revisión (algún caso fuera de tolerancia
 * o uso no planificado).
 * @param {ConsumptionVariance[]} variances
 * @returns {boolean}
 */
export function requiresReview(variances) {
  return (variances || []).some((v) => !v.within_tolerance);
}
