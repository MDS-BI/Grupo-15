/**
 * @file Puertos de integración de solo lectura/escritura simulada.
 * Logística (inventario) y Calidad. Ver plan.md §4.2 y data-model.md §3.15.
 */

/**
 * Inventario en memoria: saldos por (warehouse_id, product_id).
 * Permite simular débito (consumo) y crédito (salida) sin backend.
 */
export class InventoryPort {
  /** @param {Array<{warehouse_id:string, product_id:string, quantity:number}>} [initial] */
  constructor(initial = []) {
    /** @type {Map<string, number>} */
    this.balances = new Map();
    for (const b of initial) {
      this.balances.set(this.#key(b.warehouse_id, b.product_id), Number(b.quantity) || 0);
    }
    /** @type {Array<Object>} */
    this.ledger = [];
  }

  #key(warehouseId, productId) {
    return `${warehouseId}::${productId}`;
  }

  /** @returns {number} */
  getBalance(warehouseId, productId) {
    return this.balances.get(this.#key(warehouseId, productId)) || 0;
  }

  /** Débito por consumo de material. @returns {{ok:boolean, balance:number, message?:string}} */
  debit(warehouseId, productId, quantity) {
    const key = this.#key(warehouseId, productId);
    const current = this.balances.get(key) || 0;
    const next = current - quantity;
    this.balances.set(key, next);
    this.ledger.push({ type: 'debit', warehouseId, productId, quantity, balance: next });
    return { ok: true, balance: next };
  }

  /** Crédito por ingreso de bien terminado. @returns {{ok:boolean, balance:number}} */
  credit(warehouseId, productId, quantity) {
    const key = this.#key(warehouseId, productId);
    const next = (this.balances.get(key) || 0) + quantity;
    this.balances.set(key, next);
    this.ledger.push({ type: 'credit', warehouseId, productId, quantity, balance: next });
    return { ok: true, balance: next };
  }
}

/**
 * Calidad: consulta de solo lectura sobre `quality_inspections`.
 * El estado de calidad de una orden se DERIVA; no se almacena en la orden.
 */
export class QualityPort {
  /** @param {Array<import('../domain/types.js').QualityInspection>} inspections */
  constructor(inspections = []) {
    this.inspections = inspections;
  }

  /** @returns {Array<import('../domain/types.js').QualityInspection>} */
  forOrder(productionOrderId) {
    return this.inspections.filter((i) => i.production_order_id === productionOrderId);
  }

  /**
   * Estado derivado: 'failed' si alguna falló; 'passed' si todas pasaron y hay ≥1;
   * 'pending' si hay pendientes; 'none' si no hay inspecciones.
   * @returns {'none'|'pending'|'passed'|'failed'}
   */
  derivedStatus(productionOrderId) {
    const list = this.forOrder(productionOrderId);
    if (list.length === 0) return 'none';
    if (list.some((i) => i.status === 'failed')) return 'failed';
    if (list.every((i) => i.status === 'passed')) return 'passed';
    return 'pending';
  }
}
