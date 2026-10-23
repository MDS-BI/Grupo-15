/**
 * @file Store de estado del módulo de manufactura (motor mock en memoria).
 * Carga los fixtures y expone consultas de dominio y acciones. Reemplazable por
 * un repositorio real sin tocar la UI. Ver plan.md §6.
 */

import * as master from './fixtures/master-data.js';
import * as bomsFx from './fixtures/boms.js';
import * as wcFx from './fixtures/work-centers.js';
import * as rtFx from './fixtures/routings.js';
import * as poFx from './fixtures/production-orders.js';
import { InventoryPort, QualityPort } from './ports/index.js';
import { assertTransition, deriveOrderStatus } from '../domain/order-state-machine.js';
import { plannedTimeMinutes } from '../domain/operation-planning.js';
import { buildBomTree, flattenBom } from '../domain/bom-explosion.js';
import { reconcileConsumption, requiresReview } from '../domain/reconciliation.js';
import { makeId } from '../domain/types.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class ManufacturingStore extends EventTarget {
  constructor() {
    super();
    this.companies = clone(master.companies);
    this.unitsOfMeasure = clone(master.unitsOfMeasure);
    this.warehouses = clone(master.warehouses);
    this.products = clone(master.products);
    this.salesOrders = clone(master.salesOrders);
    this.qualityInspections = clone(master.qualityInspections);

    this.billOfMaterials = clone(bomsFx.billOfMaterials);
    this.bomComponents = clone(bomsFx.bomComponents);
    this.workCenters = clone(wcFx.workCenters);
    this.routings = clone(rtFx.routings);
    this.routingOperations = clone(rtFx.routingOperations);

    this.productionOrders = clone(poFx.productionOrders);
    this.productionOrderOperations = clone(poFx.productionOrderOperations);
    this.materialConsumption = clone(poFx.materialConsumption);
    this.productionOutput = clone(poFx.productionOutput);

    this.inventory = new InventoryPort([
      { warehouse_id: 'wh_mp', product_id: 'comp_tubo', quantity: 5000 },
      { warehouse_id: 'wh_mp', product_id: 'comp_llanta', quantity: 1000 },
      { warehouse_id: 'wh_mp', product_id: 'comp_rayos', quantity: 1000 },
      { warehouse_id: 'wh_mp', product_id: 'comp_maza', quantity: 1000 },
      { warehouse_id: 'wh_mp', product_id: 'rm_pintura', quantity: 500 },
      { warehouse_id: 'wh_mp', product_id: 'rm_soldadura', quantity: 800 },
      { warehouse_id: 'wh_pt', product_id: 'prod_bici', quantity: 49 },
    ]);
    this.quality = new QualityPort(this.qualityInspections);

    // Aplica el estado real del inventario a partir de los registros existentes.
    for (const c of this.materialConsumption) {
      this.inventory.debit(c.warehouse_id, c.component_product_id, c.quantity_consumed);
    }
    for (const o of this.productionOutput) {
      this.inventory.credit(o.warehouse_id, o.product_id, o.quantity_produced);
    }
  }

  #emit() {
    this.dispatchEvent(new Event('change'));
  }

  /* -------------------- Ayudantes de consulta -------------------- */

  productById(id) {
    return this.products.find((p) => p.id === id) || null;
  }
  warehouseById(id) {
    return this.warehouses.find((w) => w.id === id) || null;
  }
  uomById(id) {
    return this.unitsOfMeasure.find((u) => u.id === id) || null;
  }
  salesOrderById(id) {
    return this.salesOrders.find((s) => s.id === id) || null;
  }
  workCenterById(id) {
    return this.workCenters.find((w) => w.id === id) || null;
  }
  orderById(id) {
    return this.productionOrders.find((o) => o.id === id) || null;
  }
  operationsForOrder(orderId) {
    return this.productionOrderOperations
      .filter((o) => o.production_order_id === orderId)
      .sort((a, b) => a.sequence - b.sequence);
  }
  consumptionForOrder(orderId) {
    return this.materialConsumption.filter((c) => c.production_order_id === orderId);
  }
  outputForOrder(orderId) {
    return this.productionOutput.filter((o) => o.production_order_id === orderId);
  }

  /* -------------------- BOM -------------------- */

  activeBoms() {
    return this.billOfMaterials.filter((b) => b.status === 'active');
  }

  bomTree(rootBomId) {
    return buildBomTree({
      boms: this.billOfMaterials,
      components: this.bomComponents,
      products: this.products,
      rootBomId,
    });
  }

  flattenedBom(rootBomId) {
    return flattenBom(this.bomTree(rootBomId));
  }

  /* -------------------- Órdenes -------------------- */

  /** Crea una orden (planned) y genera sus operaciones congeladas. */
  createOrder(input) {
    const order = {
      id: makeId('po'),
      company_id: 'cmp_1',
      order_number: input.order_number || this.#nextOrderNumber(),
      product_id: input.product_id,
      bom_id: input.bom_id,
      routing_id: input.routing_id || null,
      sales_order_id: input.sales_order_id || null,
      warehouse_id: input.warehouse_id,
      quantity_planned: Number(input.quantity_planned),
      status: 'planned',
      planned_start_date: input.planned_start_date || null,
      planned_end_date: input.planned_end_date || null,
      actual_start_date: null,
      actual_end_date: null,
      priority: input.priority || 'normal',
      notes: input.notes || '',
    };
    this.productionOrders.push(order);
    this.#generateOperations(order);
    this.#emit();
    return order;
  }

  /** Transiciona el estado de una orden validando la máquina de estados. */
  transitionOrder(orderId, to) {
    const order = this.orderById(orderId);
    if (!order) throw new Error(`Orden no encontrada: ${orderId}`);
    assertTransition(order.status, to);
    order.status = to;
    const now = new Date().toISOString();
    if (to === 'in_progress' && !order.actual_start_date) order.actual_start_date = now.slice(0, 10);
    if (to === 'completed' && !order.actual_end_date) order.actual_end_date = now.slice(0, 10);
    this.#emit();
    return order;
  }

  /** Recalcula el estado de la orden a partir de sus operaciones. */
  recomputeOrderStatus(orderId) {
    const order = this.orderById(orderId);
    if (!order || order.status === 'cancelled') return order;
    if (order.status === 'planned') return order;
    const derived = deriveOrderStatus(this.operationsForOrder(orderId));
    order.status = derived;
    if (derived === 'completed') {
      order.actual_end_date = order.actual_end_date || new Date().toISOString().slice(0, 10);
    }
    this.#emit();
    return order;
  }

  #generateOperations(order) {
    if (!order.routing_id) return;
    const ops = this.routingOperations
      .filter((ro) => ro.routing_id === order.routing_id)
      .sort((a, b) => a.sequence - b.sequence);
    for (const ro of ops) {
      this.productionOrderOperations.push({
        id: makeId('poo'),
        production_order_id: order.id,
        routing_operation_id: ro.id,
        work_center_id: ro.work_center_id,
        sequence: ro.sequence,
        status: 'pending',
        planned_time_minutes: plannedTimeMinutes(ro, order.quantity_planned),
        actual_time_minutes: null,
        quantity_completed: 0,
        scrap_quantity: 0,
        operator_id: null,
        started_at: null,
        completed_at: null,
      });
    }
  }

  #nextOrderNumber() {
    const nums = this.productionOrders
      .map((o) => Number(String(o.order_number).replace(/\D/g, '')))
      .filter((n) => !Number.isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 3000) + 1;
    return `OP-${next}`;
  }

  /* -------------------- Ejecución -------------------- */

  startOperation(operationId) {
    const op = this.productionOrderOperations.find((o) => o.id === operationId);
    if (!op) throw new Error(`Operación no encontrada: ${operationId}`);
    if (op.status !== 'pending' && op.status !== 'paused') {
      throw new Error(`No se puede iniciar una operación en estado "${op.status}".`);
    }
    op.status = 'in_progress';
    op.started_at = op.started_at || new Date().toISOString();
    const order = this.orderById(op.production_order_id);
    if (order && order.status === 'released') {
      assertTransition(order.status, 'in_progress');
      order.status = 'in_progress';
      order.actual_start_date = order.actual_start_date || new Date().toISOString().slice(0, 10);
    }
    this.#emit();
    return op;
  }

  pauseOperation(operationId) {
    const op = this.productionOrderOperations.find((o) => o.id === operationId);
    if (!op || op.status !== 'in_progress') {
      throw new Error('Solo se puede pausar una operación en progreso.');
    }
    op.status = 'paused';
    this.#emit();
    return op;
  }

  completeOperation(operationId, { actual_time_minutes, quantity_completed = 0, scrap_quantity = 0 } = {}) {
    const op = this.productionOrderOperations.find((o) => o.id === operationId);
    if (!op) throw new Error(`Operación no encontrada: ${operationId}`);
    const minutes = Number(actual_time_minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      throw new Error('actual_time_minutes debe ser mayor que 0.');
    }
    op.status = 'completed';
    op.actual_time_minutes = minutes;
    op.quantity_completed = Number(quantity_completed) || 0;
    op.scrap_quantity = Number(scrap_quantity) || 0;
    op.completed_at = new Date().toISOString();
    this.recomputeOrderStatus(op.production_order_id);
    this.#emit();
    return op;
  }

  /* -------------------- Consumo / Salida -------------------- */

  recordConsumption(input) {
    const record = {
      id: makeId('mc'),
      production_order_id: input.production_order_id,
      po_operation_id: input.po_operation_id || null,
      component_product_id: input.component_product_id,
      bom_component_id: input.bom_component_id || null,
      warehouse_id: input.warehouse_id,
      quantity_consumed: Number(input.quantity_consumed),
      uom_id: input.uom_id,
      lot_number: input.lot_number || '',
      consumed_at: new Date().toISOString(),
      consumed_by: input.consumed_by || null,
    };
    this.materialConsumption.push(record);
    this.inventory.debit(record.warehouse_id, record.component_product_id, record.quantity_consumed);
    this.#emit();
    return record;
  }

  recordOutput(input) {
    const record = {
      id: makeId('out'),
      production_order_id: input.production_order_id,
      product_id: input.product_id,
      warehouse_id: input.warehouse_id,
      quantity_produced: Number(input.quantity_produced),
      scrap_quantity: Number(input.scrap_quantity) || 0,
      lot_number: input.lot_number || '',
      uom_id: input.uom_id,
      produced_at: new Date().toISOString(),
      recorded_by: input.recorded_by || null,
    };
    this.productionOutput.push(record);
    this.inventory.credit(record.warehouse_id, record.product_id, record.quantity_produced);
    this.#emit();
    return record;
  }

  /* -------------------- Analítica -------------------- */

  reconcile(orderId) {
    const order = this.orderById(orderId);
    if (!order) return [];
    return reconcileConsumption({
      bomComponents: this.bomComponents.filter((c) => c.bom_id === order.bom_id),
      consumptions: this.consumptionForOrder(orderId),
      quantityPlanned: order.quantity_planned,
    });
  }

  reconciliationNeedsReview(orderId) {
    return requiresReview(this.reconcile(orderId));
  }

  orderQualityStatus(orderId) {
    return this.quality.derivedStatus(orderId);
  }

  /** KPIs para el panel (dashboard). */
  kpis() {
    const active = this.productionOrders.filter(
      (o) => o.status === 'released' || o.status === 'in_progress'
    ).length;
    const totalProduced = this.productionOutput.reduce((s, o) => s + o.quantity_produced, 0);
    const totalScrap = this.productionOutput.reduce((s, o) => s + o.scrap_quantity, 0);
    const totalPlanned = this.productionOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((s, o) => s + o.quantity_planned, 0);
    const scrapRate =
      totalProduced + totalScrap > 0 ? totalScrap / (totalProduced + totalScrap) : 0;
    const completionRate = totalPlanned > 0 ? totalProduced / totalPlanned : 0;
    return {
      activeOrders: active,
      totalOrders: this.productionOrders.length,
      totalProduced,
      totalScrap,
      scrapRate,
      completionRate,
      byStatus: this.#countBy(this.productionOrders, 'status'),
    };
  }

  /** Carga pendiente por centro de trabajo (minutos de operaciones no completadas). */
  workCenterLoads() {
    return this.workCenters.map((wc) => {
      const ops = this.productionOrderOperations.filter(
        (o) => o.work_center_id === wc.id && o.status !== 'completed'
      );
      const load = ops.reduce((s, o) => s + o.planned_time_minutes, 0);
      return { workCenter: wc, loadMinutes: load, pendingOperations: ops.length };
    });
  }

  #countBy(list, key) {
    const out = {};
    for (const item of list) out[item[key]] = (out[item[key]] || 0) + 1;
    return out;
  }
}

/** Instancia única compartida por las vistas (mock singleton). */
export const store = new ManufacturingStore();
